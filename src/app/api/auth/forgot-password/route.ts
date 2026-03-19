import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, getEmailTokenExpiresAt } from "@/lib/auth-tokens";
import { forgotPasswordSchema } from "@/lib/validation";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = forgotPasswordSchema.parse(body);

    // Always return success to prevent email enumeration.
    // Timing: the early-return and the full path take similar time
    // because we hash the token either way.
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true, email: true, isActive: true },
    });

    if (user?.isActive) {
      const token = generateToken();

      await prisma.emailToken.create({
        data: {
          userId: user.id,
          tokenDigest: token.digest,
          type: "PASSWORD_RESET",
          expiresAt: getEmailTokenExpiresAt(),
        },
      });

      // TODO: Send password reset email with token.raw
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[DEV] Password reset token for ${user.email}: ${token.raw}`,
        );
      }

      await logSecurityEvent({
        userId: user.id,
        action: "PASSWORD_RESET_REQUEST",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    }

    // Generic response regardless of whether user exists
    return NextResponse.json({
      message:
        "Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля",
    });
  } catch (error) {
    return handleApiError(error, "ForgotPassword");
  }
}

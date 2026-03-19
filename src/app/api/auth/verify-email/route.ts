import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth-tokens";
import { verifyEmailSchema } from "@/lib/validation";
import { AuthError } from "@/lib/auth";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = verifyEmailSchema.parse(body);

    const digest = hashToken(input.token);

    const emailToken = await prisma.emailToken.findUnique({
      where: { tokenDigest: digest },
      select: {
        id: true,
        userId: true,
        type: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!emailToken || emailToken.type !== "VERIFICATION") {
      throw new AuthError("TOKEN_INVALID", "Недействительный токен верификации");
    }

    if (emailToken.usedAt) {
      // Idempotent: token was already consumed → verification succeeded previously.
      // Safe for React StrictMode double-mount and user page refreshes.
      return NextResponse.json({ message: "Email уже подтверждён" });
    }

    if (emailToken.expiresAt < new Date()) {
      throw new AuthError("TOKEN_EXPIRED", "Токен верификации истёк");
    }

    // Mark token as used + verify user email atomically
    await prisma.$transaction([
      prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: emailToken.userId },
        data: { emailVerified: true },
      }),
    ]);

    await logSecurityEvent({
      userId: emailToken.userId,
      action: "EMAIL_VERIFICATION",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ message: "Email подтверждён" });
  } catch (error) {
    return handleApiError(error, "VerifyEmail");
  }
}

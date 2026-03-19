import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/auth-password";
import { resetPasswordSchema } from "@/lib/validation";
import { AuthError } from "@/lib/auth";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = resetPasswordSchema.parse(body);

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

    if (!emailToken || emailToken.type !== "PASSWORD_RESET") {
      throw new AuthError("TOKEN_INVALID", "Недействительный токен сброса пароля");
    }

    if (emailToken.usedAt) {
      throw new AuthError("TOKEN_INVALID", "Токен уже был использован");
    }

    if (emailToken.expiresAt < new Date()) {
      throw new AuthError("TOKEN_EXPIRED", "Токен сброса пароля истёк");
    }

    const newPasswordHash = await hashPassword(input.password);

    // Atomically: mark token used + update password + invalidate ALL sessions
    await prisma.$transaction([
      prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: emailToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      // Invalidate all sessions — user must re-login everywhere
      prisma.session.deleteMany({
        where: { userId: emailToken.userId },
      }),
    ]);

    await logSecurityEvent({
      userId: emailToken.userId,
      action: "PASSWORD_RESET_SUCCESS",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    return handleApiError(error, "ResetPassword");
  }
}

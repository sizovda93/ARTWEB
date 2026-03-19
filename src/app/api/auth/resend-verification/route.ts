import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, getEmailTokenExpiresAt } from "@/lib/auth-tokens";
import { requireAuth, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { handleApiError } from "@/lib/api-response";

const RATE_LIMIT_SECONDS = 60;

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    // Already verified — no-op success
    if (ctx.emailVerified) {
      return NextResponse.json({ message: "Email уже подтверждён" });
    }

    // Rate limit: check for recent VERIFICATION token (last 60s)
    const recentToken = await prisma.emailToken.findFirst({
      where: {
        userId: ctx.userId,
        type: "VERIFICATION",
        createdAt: { gt: new Date(Date.now() - RATE_LIMIT_SECONDS * 1000) },
      },
      select: { id: true },
    });

    if (recentToken) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT",
            message: "Подождите минуту перед повторной отправкой",
          },
        },
        { status: 429 },
      );
    }

    // Invalidate old unused VERIFICATION tokens
    await prisma.emailToken.updateMany({
      where: {
        userId: ctx.userId,
        type: "VERIFICATION",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Generate new verification token
    const token = generateToken();
    await prisma.emailToken.create({
      data: {
        userId: ctx.userId,
        tokenDigest: token.digest,
        type: "VERIFICATION",
        expiresAt: getEmailTokenExpiresAt(),
      },
    });

    // TODO: Send verification email with token.raw
    if (process.env.NODE_ENV !== "production") {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true },
      });
      console.log(
        `[DEV] Resend verification token for ${user?.email}: ${token.raw}`,
      );
    }

    await logSecurityEvent({
      userId: ctx.userId,
      action: "RESEND_VERIFICATION",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ message: "Письмо отправлено" });
  } catch (error) {
    return handleApiError(error, "ResendVerification");
  }
}

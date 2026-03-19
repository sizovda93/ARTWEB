import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashToken,
  generateToken,
  createAccessToken,
  getRefreshTokenExpiresAt,
} from "@/lib/auth-tokens";
import { setAuthCookies, setCsrfCookie, clearAuthCookies } from "@/lib/auth-cookies";
import { derivePartnerStatus } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";

export async function POST(request: NextRequest) {
  try {
    const refreshTokenRaw = request.cookies.get("refresh_token")?.value;
    if (!refreshTokenRaw) {
      return NextResponse.json(
        { error: { code: "TOKEN_INVALID", message: "Refresh token отсутствует" } },
        { status: 401 },
      );
    }

    const digest = hashToken(refreshTokenRaw);

    // Find session by token digest
    const session = await prisma.session.findUnique({
      where: { tokenDigest: digest },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!session) {
      // Possible token reuse → log suspicious activity
      await logSecurityEvent({
        action: "SUSPICIOUS_ACTIVITY",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { reason: "refresh_token_reuse_or_invalid" },
      });
      const response = NextResponse.json(
        { error: { code: "TOKEN_INVALID", message: "Недействительный refresh token" } },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      const response = NextResponse.json(
        { error: { code: "TOKEN_EXPIRED", message: "Refresh token истёк" } },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    // Check user status
    if (!session.user.isActive) {
      await prisma.session.delete({ where: { id: session.id } });
      const response = NextResponse.json(
        { error: { code: "USER_INACTIVE", message: "Аккаунт деактивирован" } },
        { status: 403 },
      );
      clearAuthCookies(response);
      return response;
    }

    // Token rotation: delete old session, create new one atomically
    const newRefreshToken = generateToken();

    const rotated = await prisma.$transaction(async (tx) => {
      const deleted = await tx.session.deleteMany({
        where: { id: session.id },
      });
      // If already deleted by concurrent request → replay attack
      if (deleted.count === 0) return null;

      await tx.session.create({
        data: {
          userId: session.user.id,
          tokenDigest: newRefreshToken.digest,
          userAgent: request.headers.get("user-agent"),
          ipAddress: getClientIp(request),
          expiresAt: getRefreshTokenExpiresAt(),
        },
      });
      return true;
    });

    if (!rotated) {
      await logSecurityEvent({
        userId: session.user.id,
        action: "SUSPICIOUS_ACTIVITY",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { reason: "concurrent_refresh_token_replay" },
      });
      const response = NextResponse.json(
        { error: { code: "TOKEN_INVALID", message: "Token уже использован" } },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    // Derive fresh partner status
    const isPartner = await derivePartnerStatus(session.user.id);
    const csrfToken = generateCsrfToken();

    const accessToken = await createAccessToken({
      sub: session.user.id,
      role: session.user.role,
      isPartner,
      emailVerified: session.user.emailVerified,
    });

    await logSecurityEvent({
      userId: session.user.id,
      action: "TOKEN_REFRESH",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        isPartner,
        emailVerified: session.user.emailVerified,
      },
    });

    setAuthCookies(response, accessToken, newRefreshToken.raw);
    setCsrfCookie(response, csrfToken);

    return response;
  } catch (error) {
    console.error("[Refresh]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } },
      { status: 500 },
    );
  }
}

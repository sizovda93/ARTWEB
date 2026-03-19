import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth-password";
import {
  createAccessToken,
  generateToken,
  getRefreshTokenExpiresAt,
} from "@/lib/auth-tokens";
import { setAuthCookies, setCsrfCookie } from "@/lib/auth-cookies";
import { loginSchema } from "@/lib/validation";
import { AuthError, derivePartnerStatus } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const emailLower = input.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      await logSecurityEvent({
        userId: user?.id,
        action: "LOGIN_FAILED",
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { email: emailLower },
      });
      throw new AuthError("INVALID_CREDENTIALS", "Неверный email или пароль");
    }

    if (!user.isActive) {
      throw new AuthError("USER_INACTIVE", "Аккаунт деактивирован");
    }

    // Derive partner status from partner_profiles (NOT from users table)
    const isPartner = await derivePartnerStatus(user.id);

    // Create access token (short-lived JWT)
    const accessToken = await createAccessToken({
      sub: user.id,
      role: user.role,
      isPartner,
      emailVerified: user.emailVerified,
    });

    // Create refresh token (long-lived, stored as SHA-256 digest)
    const refreshToken = generateToken();
    const csrfToken = generateCsrfToken();

    // Persist session
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenDigest: refreshToken.digest,
        userAgent: request.headers.get("user-agent"),
        ipAddress: getClientIp(request),
        expiresAt: getRefreshTokenExpiresAt(),
      },
    });

    await logSecurityEvent({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isPartner,
        emailVerified: user.emailVerified,
      },
    });

    setAuthCookies(response, accessToken, refreshToken.raw);
    setCsrfCookie(response, csrfToken);

    return response;
  } catch (error) {
    return handleApiError(error, "Login");
  }
}

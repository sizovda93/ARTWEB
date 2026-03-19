import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth-tokens";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { validateCsrf } from "@/lib/csrf";
import { getAuthContext } from "@/lib/auth";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext();

    // Require CSRF only for authenticated users.
    // If session is already stale (no ctx), allow clearing cookies without CSRF
    // to prevent users from being stuck in a "can't logout" state.
    if (ctx && !validateCsrf(request)) {
      return NextResponse.json(
        { error: { code: "CSRF_INVALID", message: "Недействительный CSRF токен" } },
        { status: 403 },
      );
    }

    // Invalidate session by refresh token digest
    const refreshTokenRaw = request.cookies.get("refresh_token")?.value;
    if (refreshTokenRaw) {
      const digest = hashToken(refreshTokenRaw);
      await prisma.session.deleteMany({
        where: { tokenDigest: digest },
      });
    }

    await logSecurityEvent({
      userId: ctx?.userId,
      action: "LOGOUT",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({ message: "Выход выполнен" });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error("[Logout]", error);
    // Always clear cookies on logout, even on error
    const response = NextResponse.json({ message: "Выход выполнен" });
    clearAuthCookies(response);
    return response;
  }
}

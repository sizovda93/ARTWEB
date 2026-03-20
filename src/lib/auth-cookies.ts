import { NextResponse } from "next/server";

const USE_SECURE_COOKIES = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const CSRF_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // matches refresh

const COOKIE_BASE = {
  httpOnly: true,
  secure: USE_SECURE_COOKIES,
  sameSite: "lax" as const,
};

/**
 * Set access_token + refresh_token + has_session cookies on response.
 * - access_token: path=/ (sent to all routes for middleware)
 * - refresh_token: path=/api/auth (only sent to auth endpoints)
 * - has_session: path=/ (non-sensitive hint for middleware to distinguish
 *   "truly unauthenticated" from "access token expired but session exists")
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookies.set("access_token", accessToken, {
    ...COOKIE_BASE,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  response.cookies.set("refresh_token", refreshToken, {
    ...COOKIE_BASE,
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  // Session hint: lets middleware know a refresh token exists.
  // refresh_token has path=/api/auth so middleware can't read it on page requests.
  response.cookies.set("has_session", "1", {
    httpOnly: false,
    secure: USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * Set CSRF cookie. NOT httpOnly — JS must read it to send as header.
 */
export function setCsrfCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set("csrf_token", token, {
    httpOnly: false,
    secure: USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    maxAge: CSRF_TOKEN_MAX_AGE,
  });
}

/**
 * Clear all auth cookies (logout / session invalidation).
 */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set("access_token", "", {
    ...COOKIE_BASE,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("refresh_token", "", {
    ...COOKIE_BASE,
    path: "/api/auth",
    maxAge: 0,
  });

  response.cookies.set("csrf_token", "", {
    httpOnly: false,
    secure: USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("has_session", "", {
    httpOnly: false,
    secure: USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

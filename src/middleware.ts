import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * MIDDLEWARE — thin auth gate. NO business logic here.
 *
 * Responsibilities:
 * 1. Skip public paths (landing, auth endpoints, health)
 * 2. Verify access token JWT (lightweight, no DB calls)
 * 3. Redirect unauthenticated users to /login (pages) or 401 (API)
 * 4. Redirect non-ADMIN users from /admin routes
 * 5. Pass user info downstream via headers (convenience only, NOT security)
 *
 * NOT responsible for:
 * - Course / KB / AI access checks → use lib/access.ts in route handlers
 * - CSRF validation → done in individual route handlers
 * - Token refresh → client-side responsibility
 */

// ─── Path classification ─────────────────────────────────────────

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/refresh-session",
]);

const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

const ADMIN_PATH_PREFIX = "/admin";
const ADMIN_API_PREFIX = "/api/admin/";

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PATH_PREFIX ||
    pathname.startsWith(ADMIN_PATH_PREFIX + "/") ||
    pathname.startsWith(ADMIN_API_PREFIX)
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// ─── Middleware ───────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Public paths — pass through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 2. Read access token
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return denyAccess(request, pathname);
  }

  // 3. Verify JWT (edge-compatible, no DB calls)
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(accessToken, secret);

    // 4. Admin route protection
    if (isAdminPath(pathname) && payload.role !== "ADMIN") {
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Требуется роль администратора" } },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    // 5. Pass user info downstream (convenience headers, NOT a security boundary)
    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.sub as string);
    response.headers.set("x-user-role", payload.role as string);
    return response;
  } catch {
    // Token expired or invalid
    return denyAccess(request, pathname);
  }
}

function denyAccess(request: NextRequest, pathname: string): NextResponse {
  if (isApiRoute(pathname)) {
    return NextResponse.json(
      { error: { code: "NOT_AUTHENTICATED", message: "Требуется авторизация" } },
      { status: 401 },
    );
  }

  // has_session cookie (path=/) hints that a refresh_token exists.
  // refresh_token itself has path=/api/auth so middleware can't read it on page requests.
  // If session hint exists → redirect to /refresh-session for silent refresh attempt.
  // If no hint → go straight to /login.
  const hasSession = request.cookies.has("has_session");
  if (hasSession) {
    const refreshUrl = new URL("/refresh-session", request.url);
    refreshUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(refreshUrl);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

// ─── Matcher ─────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - Static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Validate CSRF: compare cookie value with X-CSRF-Token header.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Double Submit Cookie pattern:
 *   1. Server sets csrf_token cookie (non-httpOnly, JS-readable)
 *   2. Client JS reads cookie and sends value as X-CSRF-Token header
 *   3. Server verifies: cookie === header
 *   4. Attacker cannot read cross-origin cookies → cannot forge the header
 */
export function validateCsrf(request: NextRequest): boolean {
  const cookieToken = request.cookies.get("csrf_token")?.value;
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken, "utf-8"),
      Buffer.from(headerToken, "utf-8"),
    );
  } catch {
    return false;
  }
}

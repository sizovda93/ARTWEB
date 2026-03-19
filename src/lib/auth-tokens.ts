import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
}

export interface AccessTokenPayload {
  sub: string;
  role: "ADMIN" | "STUDENT";
  isPartner: boolean;
  emailVerified: boolean;
}

export async function createAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || "15m";
  return new SignJWT({
    role: payload.role,
    isPartner: payload.isPartner,
    emailVerified: payload.emailVerified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: (payload.role as "ADMIN" | "STUDENT") || "STUDENT",
      isPartner: (payload.isPartner as boolean) || false,
      emailVerified: (payload.emailVerified as boolean) || false,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically secure random token.
 * Returns raw token (to send to client) and SHA-256 digest (to store in DB).
 */
export function generateToken(): { raw: string; digest: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const digest = hashToken(raw);
  return { raw, digest };
}

/**
 * SHA-256 hash of a token. Used for DB lookup: hash(incoming) → WHERE token_digest = ?
 */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Parse duration string ("15m", "7d", "1h") into milliseconds.
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
}

export function getRefreshTokenExpiresAt(): Date {
  const duration = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
  return new Date(Date.now() + parseDuration(duration));
}

export function getEmailTokenExpiresAt(): Date {
  return new Date(Date.now() + parseDuration("24h"));
}

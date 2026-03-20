import { cookies } from "next/headers";
import { verifyAccessToken } from "./auth-tokens";
import { prisma } from "./prisma";

// ─── Auth Context ────────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  role: "ADMIN" | "STUDENT";
  isPartner: boolean;
  emailVerified: boolean;
}

/**
 * Get auth context from cookies.
 * Works in Server Components, Server Actions, and Route Handlers.
 * Returns null if not authenticated or token is invalid.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return {
    userId: payload.sub,
    role: payload.role,
    isPartner: payload.isPartner,
    emailVerified: payload.emailVerified,
  };
}

/**
 * Require authenticated user. Throws AuthError if not authenticated.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", "Требуется авторизация");
  return ctx;
}

/**
 * Require authenticated user with verified email.
 * Use for sensitive actions: AI chat, assignment submissions.
 * Login itself does NOT require verification (user must be able to
 * log in, see the "verify your email" banner, and resend the link).
 */
export async function requireVerifiedEmail(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.emailVerified) {
    throw new AuthError("EMAIL_NOT_VERIFIED", "Необходимо подтвердить email");
  }
  return ctx;
}

/**
 * Require ADMIN role. Throws AuthError if not admin.
 */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role !== "ADMIN") {
    throw new AuthError("FORBIDDEN", "Требуется роль администратора");
  }
  return ctx;
}

// ─── DB-backed fresh state checks ────────────────────────────────
// JWT claims are cached for 15 minutes. For sensitive mutations
// (admin actions, access grants), verify current DB state.

/**
 * Re-check user state from DB. Use for sensitive operations where
 * a 15-minute stale JWT is not acceptable (admin actions, access grants).
 * Throws if user is inactive or not found.
 */
export async function requireAuthFresh(): Promise<AuthContext> {
  const ctx = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { isActive: true, role: true, emailVerified: true },
  });
  if (!user || !user.isActive) {
    throw new AuthError("USER_INACTIVE", "Аккаунт деактивирован");
  }
  // Return DB-fresh values, not JWT-cached ones
  return {
    ...ctx,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

/**
 * Fresh admin check — hits DB to verify role hasn't been revoked.
 * Use for admin mutations (user management, access grants, etc.).
 */
export async function requireAdminFresh(): Promise<AuthContext> {
  const ctx = await requireAuthFresh();
  if (ctx.role !== "ADMIN") {
    throw new AuthError("FORBIDDEN", "Требуется роль администратора");
  }
  return ctx;
}

// ─── Partner Status (derived, not stored in users) ───────────────

/**
 * Derive partner status from partner_profiles table.
 * Called at login/refresh to populate JWT claim.
 * Source of truth: partner_profiles.is_approved (NOT User.isPartner).
 */
export async function derivePartnerStatus(userId: string): Promise<boolean> {
  const profile = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { isApproved: true },
  });
  return profile?.isApproved ?? false;
}

// ─── Auth Error ──────────────────────────────────────────────────

export type AuthErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "VALIDATION_ERROR"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "USER_INACTIVE"
  | "EMAIL_NOT_VERIFIED"
  | "CONFLICT";

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  NOT_AUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  FORBIDDEN: 403,
  USER_INACTIVE: 403,
  EMAIL_NOT_VERIFIED: 403,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
};

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }

  get status(): number {
    return AUTH_ERROR_STATUS[this.code];
  }
}

import { prisma } from "./prisma";

export type SecurityAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "REGISTER"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_SUCCESS"
  | "EMAIL_VERIFICATION"
  | "TOKEN_REFRESH"
  | "RESEND_VERIFICATION"
  | "SUSPICIOUS_ACTIVITY"
  | "ADMIN_USER_ACTIVATE"
  | "ADMIN_USER_DEACTIVATE"
  | "ADMIN_USER_ROLE_CHANGE"
  | "ADMIN_PARTNER_APPROVE"
  | "ADMIN_PARTNER_REVOKE"
  | "ADMIN_SESSIONS_TERMINATE";

interface SecurityEvent {
  userId?: string;
  action: SecurityAction;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log a security event. Fire-and-forget — never throws.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        ipAddress: event.ipAddress ?? undefined,
        userAgent: event.userAgent ?? undefined,
        metadata: (event.metadata as Record<string, string>) ?? undefined,
      },
    });
  } catch (error) {
    console.error("[SecurityLog] Failed to log event:", error);
  }
}

/**
 * Extract client IP from request headers (X-Forwarded-For / X-Real-IP).
 */
export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

import { prisma } from "./prisma";
import type { UserRole, Prisma } from "@/generated/prisma/client";

export type AuditAction =
  | "user_activated"
  | "user_deactivated"
  | "user_role_changed"
  | "partner_approved"
  | "partner_revoked"
  | "user_sessions_terminated"
  | "tariff_created"
  | "tariff_updated"
  | "tariff_activated"
  | "tariff_deactivated"
  | "tariff_course_linked"
  | "tariff_course_unlinked"
  | "access_granted"
  | "access_revoked";

type JsonValue = Prisma.InputJsonValue;

interface AuditEntry {
  actorId: string;
  actorRole: UserRole;
  action: AuditAction;
  targetType: string;
  targetId: string;
  previousData?: JsonValue;
  newData?: JsonValue;
  details?: JsonValue;
  ipAddress?: string | null;
}

/**
 * Write a business audit log entry.
 * Designed to run INSIDE a Prisma transaction — accepts either
 * the global client or a transaction client.
 */
export async function writeAuditLog(
  entry: AuditEntry,
  tx: Pick<typeof prisma, "auditLog"> = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      previousData: entry.previousData ?? undefined,
      newData: entry.newData ?? undefined,
      details: entry.details ?? undefined,
      ipAddress: entry.ipAddress ?? undefined,
    },
  });
}

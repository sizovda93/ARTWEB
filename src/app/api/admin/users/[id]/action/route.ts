import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";

const generateReferralCode = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8,
);

const MAX_REFERRAL_RETRIES = 5;

const actionSchema = z.union([
  z.object({ type: z.literal("activate") }),
  z.object({ type: z.literal("deactivate") }),
  z.object({
    type: z.literal("set_role"),
    role: z.enum(["ADMIN", "STUDENT"]),
  }),
  z.object({
    type: z.literal("set_partner"),
    approved: z.boolean(),
  }),
  z.object({ type: z.literal("terminate_sessions") }),
]);

/**
 * Count active admins excluding a specific user.
 * Used inside transactions to guard last-admin scenarios.
 */
async function countOtherActiveAdmins(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  excludeUserId: string,
): Promise<number> {
  return tx.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      id: { not: excludeUserId },
    },
  });
}

/**
 * Generate a unique referral code with retry on conflict.
 */
async function generateUniqueReferralCode(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  for (let attempt = 0; attempt < MAX_REFERRAL_RETRIES; attempt++) {
    const code = generateReferralCode();
    const existing = await tx.partnerProfile.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error(
    "Не удалось сгенерировать уникальный реферальный код после нескольких попыток",
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminFresh();

    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: targetUserId } = await params;
    const body = await request.json();
    const input = actionSchema.parse(body);
    const ip = getClientIp(request);

    // Verify target user exists (outside transaction — read-only)
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        isActive: true,
        partnerProfile: { select: { isApproved: true, referralCode: true } },
      },
    });
    if (!targetUser) {
      throw new AuthError("VALIDATION_ERROR", "Пользователь не найден");
    }

    const isSelf = targetUserId === auth.userId;

    switch (input.type) {
      // ─── Activate / Deactivate ───────────────────────────────
      case "activate":
      case "deactivate": {
        if (input.type === "deactivate" && isSelf) {
          throw new AuthError(
            "FORBIDDEN",
            "Нельзя деактивировать свой аккаунт",
          );
        }

        const isActive = input.type === "activate";

        // Last active admin guard
        if (
          input.type === "deactivate" &&
          targetUser.role === "ADMIN" &&
          targetUser.isActive
        ) {
          const otherAdmins = await countOtherActiveAdmins(
            prisma,
            targetUserId,
          );
          if (otherAdmins === 0) {
            throw new AuthError(
              "FORBIDDEN",
              "Нельзя деактивировать последнего активного администратора",
            );
          }
        }

        // Transaction: update user + delete sessions + audit log
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: targetUserId },
            data: { isActive },
          });

          if (!isActive) {
            await tx.session.deleteMany({
              where: { userId: targetUserId },
            });
          }

          await writeAuditLog(
            {
              actorId: auth.userId,
              actorRole: auth.role,
              action: isActive ? "user_activated" : "user_deactivated",
              targetType: "User",
              targetId: targetUserId,
              previousData: { isActive: targetUser.isActive },
              newData: { isActive },
              ipAddress: ip,
            },
            tx,
          );
        });

        // Security log — fire-and-forget, outside transaction
        await logSecurityEvent({
          userId: auth.userId,
          action: isActive ? "ADMIN_USER_ACTIVATE" : "ADMIN_USER_DEACTIVATE",
          ipAddress: ip,
          metadata: { targetUserId },
        });
        break;
      }

      // ─── Set Role ────────────────────────────────────────────
      case "set_role": {
        if (isSelf && input.role !== "ADMIN") {
          throw new AuthError(
            "FORBIDDEN",
            "Нельзя снять роль администратора с себя",
          );
        }

        // Last active admin guard: demoting an active admin
        if (
          targetUser.role === "ADMIN" &&
          targetUser.isActive &&
          input.role !== "ADMIN"
        ) {
          const otherAdmins = await countOtherActiveAdmins(
            prisma,
            targetUserId,
          );
          if (otherAdmins === 0) {
            throw new AuthError(
              "FORBIDDEN",
              "Нельзя понизить роль последнего активного администратора",
            );
          }
        }

        // Transaction: update role + terminate sessions + audit log
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: targetUserId },
            data: { role: input.role },
          });

          await tx.session.deleteMany({
            where: { userId: targetUserId },
          });

          await writeAuditLog(
            {
              actorId: auth.userId,
              actorRole: auth.role,
              action: "user_role_changed",
              targetType: "User",
              targetId: targetUserId,
              previousData: { role: targetUser.role },
              newData: { role: input.role },
              ipAddress: ip,
            },
            tx,
          );
        });

        await logSecurityEvent({
          userId: auth.userId,
          action: "ADMIN_USER_ROLE_CHANGE",
          ipAddress: ip,
          metadata: {
            targetUserId,
            previousRole: targetUser.role,
            newRole: input.role,
          },
        });
        break;
      }

      // ─── Set Partner ─────────────────────────────────────────
      case "set_partner": {
        // Transaction: upsert partner profile + audit log
        await prisma.$transaction(async (tx) => {
          if (input.approved) {
            const referralCode = await generateUniqueReferralCode(tx);
            await tx.partnerProfile.upsert({
              where: { userId: targetUserId },
              create: {
                userId: targetUserId,
                referralCode,
                isApproved: true,
              },
              update: { isApproved: true },
            });
          } else {
            await tx.partnerProfile.updateMany({
              where: { userId: targetUserId },
              data: { isApproved: false },
            });
          }

          await writeAuditLog(
            {
              actorId: auth.userId,
              actorRole: auth.role,
              action: input.approved ? "partner_approved" : "partner_revoked",
              targetType: "User",
              targetId: targetUserId,
              previousData: {
                isApproved: targetUser.partnerProfile?.isApproved ?? null,
              },
              newData: { isApproved: input.approved },
              ipAddress: ip,
            },
            tx,
          );
        });

        await logSecurityEvent({
          userId: auth.userId,
          action: input.approved
            ? "ADMIN_PARTNER_APPROVE"
            : "ADMIN_PARTNER_REVOKE",
          ipAddress: ip,
          metadata: { targetUserId },
        });
        break;
      }

      // ─── Terminate Sessions ──────────────────────────────────
      case "terminate_sessions": {
        // Transaction: delete sessions + audit log
        let sessionsTerminated = 0;
        await prisma.$transaction(async (tx) => {
          const result = await tx.session.deleteMany({
            where: { userId: targetUserId },
          });
          sessionsTerminated = result.count;

          await writeAuditLog(
            {
              actorId: auth.userId,
              actorRole: auth.role,
              action: "user_sessions_terminated",
              targetType: "User",
              targetId: targetUserId,
              details: { sessionsTerminated: result.count },
              ipAddress: ip,
            },
            tx,
          );
        });

        await logSecurityEvent({
          userId: auth.userId,
          action: "ADMIN_SESSIONS_TERMINATE",
          ipAddress: ip,
          metadata: { targetUserId, sessionsTerminated },
        });
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminUserAction");
  }
}

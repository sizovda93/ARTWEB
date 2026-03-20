import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";

const grantSchema = z.object({
  userId: z.string().uuid(),
  resourceType: z.enum(["COURSE", "KNOWLEDGE_BASE", "AI_CHAT"]),
  resourceId: z.string().uuid().optional(),
  tier: z.enum(["BASIC", "STANDARD", "PARTNER"]).optional(),
  expiresAt: z.string().datetime().optional(),
  dailyLimit: z.number().int().min(0).optional(),
  monthlyLimit: z.number().int().min(0).optional(),
});

const revokeSchema = z.object({
  grantId: z.string().uuid(),
});

/** GET /api/admin/access-grants?userId=xxx — list user's active grants */
export async function GET(request: NextRequest) {
  try {
    await requireAdminFresh();

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      throw new AuthError("VALIDATION_ERROR", "userId обязателен");
    }

    const grants = await prisma.accessGrant.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Enrich COURSE grants with course info
    const courseIds = grants
      .filter((g) => g.resourceType === "COURSE" && g.resourceId)
      .map((g) => g.resourceId!);

    const courses =
      courseIds.length > 0
        ? await prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, title: true },
          })
        : [];

    const courseMap = new Map(courses.map((c) => [c.id, c.title]));

    const enriched = grants.map((g) => ({
      id: g.id,
      resourceType: g.resourceType,
      resourceId: g.resourceId,
      resourceTitle:
        g.resourceType === "COURSE" && g.resourceId
          ? courseMap.get(g.resourceId) ?? null
          : null,
      grantedVia: g.grantedVia,
      tier: g.tier,
      isActive: g.isActive,
      expiresAt: g.expiresAt?.toISOString() ?? null,
      revokedAt: g.revokedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    }));

    return NextResponse.json({ grants: enriched });
  } catch (error) {
    return handleApiError(error, "AdminAccessGrantsList");
  }
}

/** POST /api/admin/access-grants — grant access manually */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const body = await request.json();
    const input = grantSchema.parse(body);
    const ip = getClientIp(request);

    // ── Strict contract validation per resourceType ──
    if (input.resourceType === "COURSE") {
      if (!input.resourceId) {
        throw new AuthError("VALIDATION_ERROR", "Для COURSE необходим resourceId (courseId)");
      }
      if (input.tier) {
        throw new AuthError("VALIDATION_ERROR", "tier не допустим для COURSE");
      }
      if (input.dailyLimit !== undefined || input.monthlyLimit !== undefined) {
        throw new AuthError("VALIDATION_ERROR", "dailyLimit/monthlyLimit не допустимы для COURSE");
      }
    } else if (input.resourceType === "KNOWLEDGE_BASE") {
      if (input.resourceId) {
        throw new AuthError("VALIDATION_ERROR", "resourceId не допустим для KNOWLEDGE_BASE");
      }
      if (!input.tier) {
        throw new AuthError("VALIDATION_ERROR", "Для KNOWLEDGE_BASE необходим tier");
      }
      if (input.dailyLimit !== undefined || input.monthlyLimit !== undefined) {
        throw new AuthError("VALIDATION_ERROR", "dailyLimit/monthlyLimit не допустимы для KNOWLEDGE_BASE");
      }
    } else {
      // AI_CHAT
      if (input.resourceId) {
        throw new AuthError("VALIDATION_ERROR", "resourceId не допустим для AI_CHAT");
      }
      if (input.tier) {
        throw new AuthError("VALIDATION_ERROR", "tier не допустим для AI_CHAT");
      }
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new AuthError("VALIDATION_ERROR", "Пользователь не найден");

    // Verify course if COURSE type
    let courseTitle: string | null = null;
    if (input.resourceType === "COURSE" && input.resourceId) {
      const course = await prisma.course.findUnique({
        where: { id: input.resourceId },
        select: { id: true, title: true },
      });
      if (!course) throw new AuthError("VALIDATION_ERROR", "Курс не найден");
      courseTitle = course.title;
    }

    // Check for existing active grant (prevent duplicates)
    const existingGrant = await prisma.accessGrant.findFirst({
      where: {
        userId: input.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        isActive: true,
      },
    });
    if (existingGrant) {
      throw new AuthError(
        "VALIDATION_ERROR",
        "У пользователя уже есть активный доступ этого типа",
      );
    }

    const grant = await prisma.$transaction(async (tx) => {
      const created = await tx.accessGrant.create({
        data: {
          userId: input.userId,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          grantedVia: "ADMIN_GRANT",
          grantedByUserId: auth.userId,
          tier: input.tier ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });

      // AI_CHAT: upsert usage limits with counter reset
      if (input.resourceType === "AI_CHAT") {
        await tx.aiUsageLimit.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            dailyLimit: input.dailyLimit ?? 10,
            monthlyLimit: input.monthlyLimit ?? 100,
            dailyRequests: 0,
            monthlyRequests: 0,
          },
          update: {
            dailyLimit: input.dailyLimit ?? 10,
            monthlyLimit: input.monthlyLimit ?? 100,
            dailyRequests: 0,
            monthlyRequests: 0,
            lastResetDaily: new Date(),
            lastResetMonthly: new Date(),
          },
        });
      }

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "access_granted",
          targetType: "AccessGrant",
          targetId: created.id,
          newData: {
            userId: input.userId,
            resourceType: input.resourceType,
            resourceId: input.resourceId ?? null,
            courseTitle,
            tier: input.tier ?? null,
            grantedVia: "ADMIN_GRANT",
            ...(input.resourceType === "AI_CHAT" && {
              dailyLimit: input.dailyLimit ?? 10,
              monthlyLimit: input.monthlyLimit ?? 100,
            }),
          },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ grant: { id: grant.id } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminAccessGrant");
  }
}

/** DELETE /api/admin/access-grants — revoke access */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const body = await request.json();
    const { grantId } = revokeSchema.parse(body);
    const ip = getClientIp(request);

    const grant = await prisma.accessGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) {
      throw new AuthError("VALIDATION_ERROR", "Доступ не найден");
    }
    if (!grant.isActive) {
      throw new AuthError("VALIDATION_ERROR", "Доступ уже отозван");
    }

    await prisma.$transaction(async (tx) => {
      await tx.accessGrant.update({
        where: { id: grantId },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedBy: auth.userId,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "access_revoked",
          targetType: "AccessGrant",
          targetId: grantId,
          previousData: {
            userId: grant.userId,
            resourceType: grant.resourceType,
            resourceId: grant.resourceId,
            isActive: true,
          },
          newData: { isActive: false },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminAccessRevoke");
  }
}

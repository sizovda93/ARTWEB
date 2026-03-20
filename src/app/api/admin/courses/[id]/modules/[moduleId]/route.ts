import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateModuleSchema } from "@/lib/validations/course";

type RouteCtx = { params: Promise<{ id: string; moduleId: string }> };

async function verifyModuleOwnership(courseId: string, moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, title: true },
  });
  if (!mod || mod.courseId !== courseId) {
    throw new AuthError("VALIDATION_ERROR", "Модуль не найден");
  }
  return mod;
}

/** PUT /api/admin/courses/[id]/modules/[moduleId] — update module */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId, moduleId } = await params;
    const body = await request.json();
    const input = updateModuleSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await verifyModuleOwnership(courseId, moduleId);

    await prisma.$transaction(async (tx) => {
      await tx.module.update({
        where: { id: moduleId },
        data: { title: input.title },
      });

      if (input.title && input.title !== existing.title) {
        await writeAuditLog(
          {
            actorId: auth.userId,
            actorRole: auth.role,
            action: "module_updated",
            targetType: "Module",
            targetId: moduleId,
            previousData: { title: existing.title },
            newData: { title: input.title },
            ipAddress: ip,
          },
          tx,
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminModuleUpdate");
  }
}

/** DELETE /api/admin/courses/[id]/modules/[moduleId] — delete module (cascades lessons) */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId, moduleId } = await params;
    const ip = getClientIp(request);

    const existing = await verifyModuleOwnership(courseId, moduleId);

    const lessonsCount = await prisma.lesson.count({ where: { moduleId } });

    await prisma.$transaction(async (tx) => {
      await tx.module.delete({ where: { id: moduleId } });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "module_deleted",
          targetType: "Module",
          targetId: moduleId,
          previousData: { courseId, title: existing.title },
          details: { cascadeDeletedLessons: lessonsCount },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminModuleDelete");
  }
}

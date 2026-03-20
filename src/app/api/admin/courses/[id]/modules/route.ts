import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createModuleSchema } from "@/lib/validations/course";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/courses/[id]/modules — create module */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId } = await params;
    const body = await request.json();
    const input = createModuleSchema.parse(body);
    const ip = getClientIp(request);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new AuthError("VALIDATION_ERROR", "Курс не найден");
    }

    const maxSort = await prisma.module.aggregate({
      where: { courseId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const mod = await prisma.$transaction(async (tx) => {
      const created = await tx.module.create({
        data: {
          courseId,
          title: input.title,
          sortOrder: nextSort,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "module_created",
          targetType: "Module",
          targetId: created.id,
          newData: { courseId, title: input.title, sortOrder: nextSort },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ module: { id: mod.id } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminModuleCreate");
  }
}

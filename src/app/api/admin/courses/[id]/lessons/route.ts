import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createLessonSchema } from "@/lib/validations/course";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/courses/[id]/lessons — create lesson */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId } = await params;
    const body = await request.json();
    const input = createLessonSchema.parse(body);
    const ip = getClientIp(request);

    const mod = await prisma.module.findUnique({
      where: { id: input.moduleId },
      select: { id: true, courseId: true },
    });
    if (!mod || mod.courseId !== courseId) {
      throw new AuthError("VALIDATION_ERROR", "Модуль не найден в этом курсе");
    }

    const maxSort = await prisma.lesson.aggregate({
      where: { moduleId: input.moduleId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const lesson = await prisma.$transaction(async (tx) => {
      const created = await tx.lesson.create({
        data: {
          moduleId: input.moduleId,
          title: input.title,
          type: input.type,
          sortOrder: nextSort,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "lesson_created",
          targetType: "Lesson",
          targetId: created.id,
          newData: {
            courseId,
            moduleId: input.moduleId,
            title: input.title,
            type: input.type,
          },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ lesson: { id: lesson.id } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminLessonCreate");
  }
}

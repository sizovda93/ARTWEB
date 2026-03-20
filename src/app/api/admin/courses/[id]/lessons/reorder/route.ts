import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { handleApiError } from "@/lib/api-response";
import { lessonReorderSchema } from "@/lib/validations/course";

type RouteCtx = { params: Promise<{ id: string }> };

/** PUT /api/admin/courses/[id]/lessons/reorder — reorder lessons within a module */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId } = await params;
    const body = await request.json();
    const { moduleId, orderedIds } = lessonReorderSchema.parse(body);

    const mod = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { courseId: true },
    });
    if (!mod || mod.courseId !== courseId) {
      throw new AuthError("VALIDATION_ERROR", "Модуль не принадлежит этому курсу");
    }

    const lessons = await prisma.lesson.findMany({
      where: { moduleId },
      select: { id: true },
    });
    const existingIds = new Set(lessons.map((l) => l.id));

    if (orderedIds.length !== existingIds.size) {
      throw new AuthError("VALIDATION_ERROR", "orderedIds должен содержать все уроки модуля");
    }
    for (const lid of orderedIds) {
      if (!existingIds.has(lid)) {
        throw new AuthError("VALIDATION_ERROR", "Урок не принадлежит этому модулю");
      }
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.lesson.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminLessonReorder");
  }
}

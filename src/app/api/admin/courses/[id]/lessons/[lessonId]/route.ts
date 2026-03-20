import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateLessonSchema } from "@/lib/validations/course";
import type { Prisma } from "@/generated/prisma/client";

type RouteCtx = { params: Promise<{ id: string; lessonId: string }> };

async function verifyLessonOwnership(courseId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    throw new AuthError("VALIDATION_ERROR", "Урок не найден");
  }
  return lesson;
}

/** GET /api/admin/courses/[id]/lessons/[lessonId] — lesson detail */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id: courseId, lessonId } = await params;

    const lesson = await verifyLessonOwnership(courseId, lessonId);

    const files = await prisma.lessonFile.findMany({
      where: { lessonId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        moduleId: lesson.moduleId,
        title: lesson.title,
        type: lesson.type,
        content: lesson.content,
        videoPath: lesson.videoPath,
        coverPath: lesson.coverPath,
        videoDuration: lesson.videoDuration,
        isFree: lesson.isFree,
        requiresAssignment: lesson.requiresAssignment,
        sortOrder: lesson.sortOrder,
        files,
      },
    });
  } catch (error) {
    return handleApiError(error, "AdminLessonDetail");
  }
}

/** PUT /api/admin/courses/[id]/lessons/[lessonId] — update lesson */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId, lessonId } = await params;
    const body = await request.json();
    const input = updateLessonSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await verifyLessonOwnership(courseId, lessonId);

    const prevSnap: Record<string, unknown> = {};
    const newSnap: Record<string, unknown> = {};
    const keys = [
      "title",
      "type",
      "content",
      "videoPath",
      "coverPath",
      "videoDuration",
      "isFree",
      "requiresAssignment",
    ] as const;
    for (const key of keys) {
      if (input[key] !== undefined && input[key] !== existing[key]) {
        prevSnap[key] = existing[key];
        newSnap[key] = input[key];
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id: lessonId },
        data: {
          title: input.title,
          type: input.type,
          content: input.content,
          videoPath: input.videoPath,
          coverPath: input.coverPath,
          videoDuration: input.videoDuration,
          isFree: input.isFree,
          requiresAssignment: input.requiresAssignment,
        },
      });

      if (Object.keys(newSnap).length > 0) {
        await writeAuditLog(
          {
            actorId: auth.userId,
            actorRole: auth.role,
            action: "lesson_updated",
            targetType: "Lesson",
            targetId: lessonId,
            previousData: prevSnap as Prisma.InputJsonValue,
            newData: newSnap as Prisma.InputJsonValue,
            ipAddress: ip,
          },
          tx,
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminLessonUpdate");
  }
}

/** DELETE /api/admin/courses/[id]/lessons/[lessonId] — delete lesson */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId, lessonId } = await params;
    const ip = getClientIp(request);

    const existing = await verifyLessonOwnership(courseId, lessonId);

    await prisma.$transaction(async (tx) => {
      await tx.lesson.delete({ where: { id: lessonId } });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "lesson_deleted",
          targetType: "Lesson",
          targetId: lessonId,
          previousData: {
            moduleId: existing.moduleId,
            title: existing.title,
          },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminLessonDelete");
  }
}

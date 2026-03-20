import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { checkLessonAccess } from "@/lib/access";
import { handleApiError } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ courseId: string; lessonId: string }> };

/** POST /api/courses/[courseId]/lessons/[lessonId]/complete — mark lesson complete */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAuth();
    const { courseId, lessonId } = await params;

    // Verify lesson belongs to course
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, module: { select: { courseId: true } } },
    });
    if (!lesson || lesson.module.courseId !== courseId) {
      throw new AuthError("VALIDATION_ERROR", "Урок не найден");
    }

    // Check access
    const hasAccess = await checkLessonAccess(auth.userId, lessonId);
    if (!hasAccess) {
      throw new AuthError("FORBIDDEN", "Нет доступа к этому уроку");
    }

    // Upsert lesson progress
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: auth.userId, lessonId } },
      create: {
        userId: auth.userId,
        lessonId,
        isCompleted: true,
        completedAt: new Date(),
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    // Recalculate course progress
    const totalLessons = await prisma.lesson.count({
      where: { module: { courseId } },
    });
    const completedLessons = await prisma.lessonProgress.count({
      where: {
        userId: auth.userId,
        isCompleted: true,
        lesson: { module: { courseId } },
      },
    });
    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId: auth.userId, courseId } },
      create: {
        userId: auth.userId,
        courseId,
        completedLessons,
        totalLessons,
        progressPercent,
        completedAt: progressPercent === 100 ? new Date() : null,
      },
      update: {
        completedLessons,
        totalLessons,
        progressPercent,
        completedAt: progressPercent === 100 ? new Date() : null,
        lastRecalculatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, completedLessons, totalLessons, progressPercent });
  } catch (error) {
    return handleApiError(error, "LessonComplete");
  }
}

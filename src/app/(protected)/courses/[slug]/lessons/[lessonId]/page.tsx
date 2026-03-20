import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkLessonAccess } from "@/lib/access";
import { Badge } from "@/components/ui/badge";
import { LessonActions } from "./lesson-actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Урок — ARTWEB",
};

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { slug, lessonId } = await params;

  // Get course by slug
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true, isPublished: true },
  });
  if (!course || !course.isPublished) notFound();

  // Get lesson with ownership check
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          courseId: true,
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, sortOrder: true, isFree: true },
          },
        },
      },
    },
  });

  if (!lesson || lesson.module.courseId !== course.id) notFound();

  // Access check
  const hasAccess = await checkLessonAccess(auth.userId, lessonId);
  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-700 font-medium mb-2">Доступ закрыт</p>
          <p className="text-sm text-amber-600 mb-4">
            Для просмотра этого урока необходим доступ к курсу.
          </p>
          <Link
            href={`/courses/${slug}`}
            className="inline-flex items-center rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-100"
          >
            &larr; К курсу
          </Link>
        </div>
      </div>
    );
  }

  // Get lesson progress
  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: auth.userId, lessonId } },
    select: { isCompleted: true },
  });
  const isCompleted = progress?.isCompleted ?? false;

  // Build all lessons flat list for prev/next navigation
  const allModules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { sortOrder: "asc" },
    select: {
      lessons: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true },
      },
    },
  });
  const allLessons = allModules.flatMap((m) => m.lessons);
  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/courses" className="hover:text-gray-600">Мои курсы</Link>
        <span>/</span>
        <Link href={`/courses/${slug}`} className="hover:text-gray-600">{course.title}</Link>
        <span>/</span>
        <span className="text-gray-600">{lesson.module.title}</span>
      </div>

      {/* Lesson header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-400">{lesson.module.title}</span>
            {lesson.isFree && <Badge variant="success">Бесплатно</Badge>}
            {isCompleted && <Badge variant="success">Пройден</Badge>}
          </div>
        </div>
      </div>

      {/* Cover */}
      {lesson.coverPath && (
        <img
          src={lesson.coverPath}
          alt={lesson.title}
          className="w-full max-h-72 object-cover rounded-xl mb-6"
        />
      )}

      {/* Video */}
      {lesson.videoPath && (lesson.type === "VIDEO" || lesson.type === "MIXED") && (
        <div className="mb-6 bg-black rounded-xl overflow-hidden">
          {lesson.videoPath.startsWith("http") ? (
            <iframe
              src={lesson.videoPath}
              className="w-full aspect-video"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          ) : (
            <video
              src={lesson.videoPath}
              controls
              className="w-full aspect-video"
            />
          )}
        </div>
      )}

      {/* Text content */}
      {lesson.content && (lesson.type === "TEXT" || lesson.type === "MIXED") && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="prose prose-gray max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {lesson.content}
          </div>
        </div>
      )}

      {/* Complete + Navigation */}
      <LessonActions
        courseId={course.id}
        courseSlug={slug}
        lessonId={lessonId}
        isCompleted={isCompleted}
        prevLessonId={prevLesson?.id ?? null}
        prevLessonTitle={prevLesson?.title ?? null}
        nextLessonId={nextLesson?.id ?? null}
        nextLessonTitle={nextLesson?.title ?? null}
      />
    </div>
  );
}

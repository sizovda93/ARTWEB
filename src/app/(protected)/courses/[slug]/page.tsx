import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCourseAccess } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Курс — ARTWEB",
};

const TYPE_LABELS: Record<string, string> = {
  VIDEO: "Видео",
  TEXT: "Текст",
  MIXED: "Смешанный",
};

export default async function StudentCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { slug } = await params;

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              isFree: true,
              coverPath: true,
            },
          },
        },
      },
    },
  });

  if (!course || !course.isPublished) notFound();

  const hasAccess = await checkCourseAccess(auth.userId, course.id);

  // Get lesson progress
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const completedLessons = lessonIds.length > 0
    ? await prisma.lessonProgress.findMany({
        where: {
          userId: auth.userId,
          lessonId: { in: lessonIds },
          isCompleted: true,
        },
        select: { lessonId: true },
      })
    : [];
  const completedSet = new Set(completedLessons.map((lp) => lp.lessonId));

  const totalLessons = lessonIds.length;
  const completedCount = completedSet.size;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <>
      <PageHeader
        title={course.title}
        description={course.description ?? undefined}
        actions={
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            &larr; Мои курсы
          </Link>
        }
      />

      {/* Cover + Progress */}
      <div className="mb-6">
        {course.coverPath && (
          <img
            src={course.coverPath}
            alt={course.title}
            className="w-full max-h-64 object-cover rounded-xl mb-4"
          />
        )}

        {hasAccess && totalLessons > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Прогресс: {completedCount} из {totalLessons} уроков
              </span>
              <Badge variant={pct === 100 ? "success" : "info"}>{pct}%</Badge>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {!hasAccess && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            У вас нет полного доступа к этому курсу. Доступны только бесплатные уроки.
          </div>
        )}
      </div>

      {/* Modules & Lessons */}
      <div className="space-y-4">
        {course.modules.map((mod) => (
          <div key={mod.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{mod.title}</h2>
              <span className="text-xs text-gray-400">{mod.lessons.length} уроков</span>
            </div>

            <div className="divide-y divide-gray-50">
              {mod.lessons.map((lesson) => {
                const isCompleted = completedSet.has(lesson.id);
                const canOpen = hasAccess || lesson.isFree;
                const isLocked = !canOpen;

                return (
                  <div key={lesson.id} className="flex items-center px-5 py-3">
                    {/* Status icon */}
                    <span className="w-6 shrink-0 text-center">
                      {isCompleted ? (
                        <span className="text-green-500" title="Пройден">&#10003;</span>
                      ) : isLocked ? (
                        <span className="text-gray-300" title="Заблокирован">&#128274;</span>
                      ) : (
                        <span className="text-gray-300">&#9675;</span>
                      )}
                    </span>

                    {/* Lesson info */}
                    <div className="flex-1 min-w-0 ml-2">
                      {canOpen ? (
                        <Link
                          href={`/courses/${slug}/lessons/${lesson.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                        >
                          {lesson.title}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">{lesson.title}</span>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {lesson.isFree && (
                        <Badge variant="success">Бесплатно</Badge>
                      )}
                      <span className="text-xs text-gray-400">
                        {TYPE_LABELS[lesson.type] ?? lesson.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

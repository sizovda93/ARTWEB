import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCourseIds } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мои курсы — ARTWEB",
};

export default async function StudentCoursesPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const accessibleIds = await getAccessibleCourseIds(auth.userId);

  const courses = accessibleIds.length > 0
    ? await prisma.course.findMany({
        where: { id: { in: accessibleIds }, isPublished: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          coverPath: true,
          modules: {
            select: { _count: { select: { lessons: true } } },
          },
        },
      })
    : [];

  // Get progress for these courses
  const progresses = courses.length > 0
    ? await prisma.courseProgress.findMany({
        where: {
          userId: auth.userId,
          courseId: { in: courses.map((c) => c.id) },
        },
        select: { courseId: true, progressPercent: true, completedLessons: true, totalLessons: true },
      })
    : [];

  const progressMap = new Map(progresses.map((p) => [p.courseId, p]));

  return (
    <>
      <PageHeader title="Мои курсы" description={`Доступно курсов: ${courses.length}`} />

      {courses.length === 0 ? (
        <EmptyState
          message="У вас пока нет доступных курсов"
          description="Обратитесь к администратору для получения доступа"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {courses.map((course) => {
            const lessonsCount = course.modules.reduce((s, m) => s + m._count.lessons, 0);
            const progress = progressMap.get(course.id);
            const pct = progress?.progressPercent ?? 0;

            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 transition-colors"
              >
                {course.coverPath ? (
                  <img
                    src={course.coverPath}
                    alt={course.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center">
                    <span className="text-4xl text-indigo-300">
                      {course.title.charAt(0)}
                    </span>
                  </div>
                )}

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {course.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>{lessonsCount} уроков</span>
                    {pct > 0 && (
                      <Badge variant={pct === 100 ? "success" : "info"}>
                        {pct}%
                      </Badge>
                    )}
                  </div>

                  {pct > 0 && (
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

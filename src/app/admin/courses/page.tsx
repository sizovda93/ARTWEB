import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Курсы — ARTWEB Admin",
};

export default async function CoursesPage() {
  try {
    await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const courses = await prisma.course.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { modules: true } },
      modules: {
        select: { _count: { select: { lessons: true } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Курсы"
        description={`Всего: ${courses.length}`}
        actions={
          <Link
            href="/admin/courses/new"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Создать курс
          </Link>
        }
      />

      {courses.length === 0 ? (
        <EmptyState message="Курсов пока нет" description="Создайте первый курс" />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Модули</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Уроки</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((c) => {
                const lessonsCount = c.modules.reduce((sum, m) => sum + m._count.lessons, 0);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/courses/${c.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {c.title}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{c.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.isPublished ? "success" : "neutral"}>
                        {c.isPublished ? "Опубликован" : "Черновик"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c._count.modules}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{lessonsCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

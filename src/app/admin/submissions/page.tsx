import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Проверка работ — ARTWEB Admin" };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  PENDING: { label: "Ожидает", variant: "warning" },
  AI_REVIEWED: { label: "AI проверено", variant: "info" },
  APPROVED: { label: "Принято", variant: "success" },
  REJECTED: { label: "Отклонено", variant: "error" },
  REVISION_REQUESTED: { label: "Доработка", variant: "warning" },
};

const TYPE_LABELS: Record<string, string> = { TEXT: "Текст", FILE_UPLOAD: "Файл", TEST: "Тест" };

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; search?: string; page?: string }>;
}) {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const sp = await searchParams;
  const statusFilter = sp.status ?? "all";
  const typeFilter = sp.type ?? "all";
  const search = sp.search ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));
  const PAGE_SIZE = 20;

  const where: Record<string, unknown> = {};
  if (statusFilter !== "all") where.status = statusFilter;
  if (typeFilter !== "all") where.assignment = { type: typeFilter };
  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [submissions, total] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        assignment: {
          select: {
            title: true,
            type: true,
            maxScore: true,
            lesson: {
              select: {
                title: true,
                module: { select: { course: { select: { title: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.assignmentSubmission.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pendingCount = await prisma.assignmentSubmission.count({ where: { status: "PENDING" } });

  return (
    <>
      <PageHeader
        title="Проверка работ"
        description={`Всего: ${total}${pendingCount > 0 ? ` · Ожидают проверки: ${pendingCount}` : ""}`}
      />

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-5">
        <input type="text" name="search" defaultValue={search} placeholder="Поиск по студенту..."
          className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <select name="status" defaultValue={statusFilter} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="all">Все статусы</option>
          <option value="PENDING">Ожидает</option>
          <option value="APPROVED">Принято</option>
          <option value="REJECTED">Отклонено</option>
          <option value="REVISION_REQUESTED">Доработка</option>
        </select>
        <select name="type" defaultValue={typeFilter} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="all">Все типы</option>
          <option value="TEXT">Текст</option>
          <option value="TEST">Тест</option>
          <option value="FILE_UPLOAD">Файл</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Найти
        </button>
      </form>

      {submissions.length === 0 ? (
        <EmptyState message="Нет работ" description={search || statusFilter !== "all" ? "Попробуйте другие фильтры" : "Студенты ещё не отправляли работы"} />
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Студент</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Задание</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Курс / Урок</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Балл</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((s) => {
                  const sc = STATUS_CONFIG[s.status] ?? { label: s.status, variant: "neutral" as const };
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/submissions/${s.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                          {s.user.firstName} {s.user.lastName}
                        </Link>
                        <p className="text-xs text-gray-400">{s.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.assignment.title}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{s.assignment.lesson.module.course.title}</p>
                        <p className="text-xs text-gray-400">{s.assignment.lesson.title}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{TYPE_LABELS[s.assignment.type]}</td>
                      <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.finalScore !== null ? `${s.finalScore}/${s.assignment.maxScore}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString("ru-RU")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/admin/submissions?status=${statusFilter}&type=${typeFilter}&search=${search}&page=${p}`}
                  className={`px-3 py-1 text-sm rounded ${p === page ? "bg-indigo-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

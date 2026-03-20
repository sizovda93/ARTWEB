import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Вебинары — ARTWEB Admin" };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  SCHEDULED: { label: "Запланирован", variant: "info" },
  LIVE: { label: "В эфире", variant: "success" },
  ENDED: { label: "Завершён", variant: "neutral" },
  CANCELLED: { label: "Отменён", variant: "error" },
};

export default async function AdminWebinarsPage() {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const webinars = await prisma.webinar.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      course: { select: { title: true } },
      _count: { select: { attendances: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Вебинары"
        description={`Всего: ${webinars.length}`}
        actions={
          <Link href="/admin/webinars/new" className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            + Создать вебинар
          </Link>
        }
      />

      {webinars.length === 0 ? (
        <EmptyState message="Вебинаров пока нет" description="Создайте первый вебинар" />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Курс</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Доступ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Участники</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {webinars.map((w) => {
                const sc = STATUS_CONFIG[w.status] ?? { label: w.status, variant: "neutral" as const };
                return (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/webinars/${w.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                        {w.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(w.scheduledAt).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{w.course?.title ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={w.isPublic ? "success" : "neutral"}>
                        {w.isPublic ? "Публичный" : "По доступу"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w._count.attendances}</td>
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

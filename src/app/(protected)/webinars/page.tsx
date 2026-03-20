import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCourseIds } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Вебинары — ARTWEB" };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  SCHEDULED: { label: "Запланирован", variant: "info" },
  LIVE: { label: "В эфире", variant: "success" },
  ENDED: { label: "Запись", variant: "neutral" },
  CANCELLED: { label: "Отменён", variant: "error" },
};

export default async function StudentWebinarsPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const accessibleCourseIds = await getAccessibleCourseIds(auth.userId);

  // Visible: public OR linked to accessible course
  const webinars = await prisma.webinar.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [
        { isPublic: true },
        ...(accessibleCourseIds.length > 0 ? [{ courseId: { in: accessibleCourseIds } }] : []),
      ],
    },
    orderBy: { scheduledAt: "desc" },
    include: { course: { select: { title: true } } },
  });

  return (
    <>
      <PageHeader title="Вебинары" description={`Доступно: ${webinars.length}`} />

      {webinars.length === 0 ? (
        <EmptyState message="Нет доступных вебинаров" description="Следите за обновлениями" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {webinars.map((w) => {
            const sc = STATUS_CONFIG[w.status] ?? { label: w.status, variant: "neutral" as const };
            const isPast = new Date(w.scheduledAt) < new Date();
            return (
              <Link
                key={w.id}
                href={`/webinars/${w.slug}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 transition-colors"
              >
                {w.coverPath ? (
                  <img src={w.coverPath} alt={w.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-purple-100 to-indigo-50 flex items-center justify-center">
                    <span className="text-4xl text-indigo-300">{w.status === "LIVE" ? "LIVE" : "W"}</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                    {w.isPublic && <Badge variant="neutral">Публичный</Badge>}
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {w.title}
                  </h3>
                  {w.description && <p className="mt-1 text-sm text-gray-500 line-clamp-2">{w.description}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {new Date(w.scheduledAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {w.course && <span>{w.course.title}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

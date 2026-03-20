import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тарифы — ARTWEB Admin",
};

const TIER_LABELS: Record<string, string> = {
  BASIC: "Basic",
  STANDARD: "Standard",
  PARTNER: "Partner",
};

const FEATURE_LABELS: Record<string, string> = {
  KNOWLEDGE_BASE_ACCESS: "База знаний",
  AI_CHAT_ACCESS: "AI-чат",
};

export default async function TariffsPage() {
  try {
    await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const tariffs = await prisma.tariff.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      tariffFeatures: true,
      tariffCourses: {
        include: { course: { select: { title: true } } },
      },
      _count: { select: { accessGrants: { where: { isActive: true } } } },
    },
  });

  return (
    <>
      <PageHeader
        title="Тарифы"
        description={`Всего: ${tariffs.length}`}
        actions={
          <Link
            href="/admin/tariffs/new"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Создать тариф
          </Link>
        }
      />

      {tariffs.length === 0 ? (
        <EmptyState message="Тарифов пока нет" description="Создайте первый тариф" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tariffs.map((t) => (
            <Link
              key={t.id}
              href={`/admin/tariffs/${t.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.slug}</p>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant={t.isActive ? "success" : "error"}>
                    {t.isActive ? "Активен" : "Неактивен"}
                  </Badge>
                  <Badge variant="info">{TIER_LABELS[t.tier] ?? t.tier}</Badge>
                </div>
              </div>

              <p className="text-2xl font-bold text-gray-900 mb-3">
                {Number(t.price).toLocaleString("ru-RU")} {t.currency}
              </p>

              {t.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {t.description}
                </p>
              )}

              <div className="space-y-1.5 text-xs text-gray-500">
                <div>
                  Курсов: {t.tariffCourses.length}
                  {t.tariffCourses.length > 0 && (
                    <span className="text-gray-400 ml-1">
                      ({t.tariffCourses.map((tc) => tc.course.title).join(", ")})
                    </span>
                  )}
                </div>
                <div>
                  Фичи:{" "}
                  {t.tariffFeatures.length > 0
                    ? t.tariffFeatures
                        .map((f) => FEATURE_LABELS[f.feature] ?? f.feature)
                        .join(", ")
                    : "—"}
                </div>
                <div>Активных доступов: {t._count.accessGrants}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

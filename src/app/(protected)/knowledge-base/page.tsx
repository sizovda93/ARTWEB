import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { AccessTier } from "@/generated/prisma/client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "База знаний — ARTWEB" };

const TIER_ORDER: Record<string, number> = { BASIC: 0, STANDARD: 1, PARTNER: 2 };

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Документ",
  TEMPLATE: "Шаблон",
  WEBINAR_RECORDING: "Запись вебинара",
};

export default async function StudentKBPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; type?: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  // Check KB access grant + tier
  const grant = await prisma.accessGrant.findFirst({
    where: {
      userId: auth.userId,
      resourceType: "KNOWLEDGE_BASE",
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { tier: true },
  });

  if (!grant?.tier) {
    return (
      <>
        <PageHeader title="База знаний" />
        <EmptyState
          message="У вас нет доступа к базе знаний"
          description="Обратитесь к администратору для получения доступа"
        />
      </>
    );
  }

  const userTierOrder = TIER_ORDER[grant.tier] ?? 0;
  const accessibleTiers = Object.entries(TIER_ORDER)
    .filter(([, order]) => order <= userTierOrder)
    .map(([tier]) => tier) as AccessTier[];

  const sp = await searchParams;
  const search = sp.search ?? "";
  const categoryFilter = sp.category ?? "";
  const typeFilter = sp.type ?? "";

  const where: Record<string, unknown> = {
    isPublished: true,
    minAccessTier: { in: accessibleTiers },
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { tags: { has: search } },
    ];
  }
  if (categoryFilter) where.category = categoryFilter;
  if (typeFilter) where.type = typeFilter;

  const items = await prisma.knowledgeItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      description: true,
      category: true,
      tags: true,
      minAccessTier: true,
      filePath: true,
      videoPath: true,
    },
  });

  // Get categories for filter
  const categories = await prisma.knowledgeItem.findMany({
    where: { isPublished: true, minAccessTier: { in: accessibleTiers } },
    distinct: ["category"],
    select: { category: true },
  });
  const uniqueCategories = categories.map((c) => c.category).filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="База знаний" description={`Доступно: ${items.length} материалов`} />

      {/* Search + Filters */}
      <form className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Поиск по названию, описанию, тегам..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        {uniqueCategories.length > 0 && (
          <select name="category" defaultValue={categoryFilter} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
            <option value="">Все категории</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <select name="type" defaultValue={typeFilter} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
          <option value="">Все типы</option>
          <option value="DOCUMENT">Документы</option>
          <option value="TEMPLATE">Шаблоны</option>
          <option value="WEBINAR_RECORDING">Записи вебинаров</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Найти
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState message="Ничего не найдено" description={search ? "Попробуйте другой запрос" : "Материалов пока нет"} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/knowledge-base/${item.slug}`}
              className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {item.title}
                </h3>
              </div>

              {item.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{item.description}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="neutral">{TYPE_LABELS[item.type]}</Badge>
                {item.category && <span className="text-xs text-gray-400">{item.category}</span>}
                {item.filePath && <span className="text-xs text-blue-500">PDF</span>}
                {item.videoPath && <span className="text-xs text-purple-500">Видео</span>}
              </div>

              {item.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

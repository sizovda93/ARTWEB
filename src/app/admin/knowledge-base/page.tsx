import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "База знаний — ARTWEB Admin" };

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Документ",
  TEMPLATE: "Шаблон",
  WEBINAR_RECORDING: "Запись вебинара",
};

const TIER_LABELS: Record<string, string> = {
  BASIC: "Basic",
  STANDARD: "Standard",
  PARTNER: "Partner",
};

export default async function AdminKBPage() {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const items = await prisma.knowledgeItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attachments: true } } },
  });

  return (
    <>
      <PageHeader
        title="База знаний"
        description={`Всего: ${items.length}`}
        actions={
          <Link href="/admin/knowledge-base/new" className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            + Создать материал
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState message="Материалов пока нет" description="Создайте первый материал" />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Уровень</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Просмотры</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/knowledge-base/${item.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                      {item.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{item.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{TYPE_LABELS[item.type] ?? item.type}</td>
                  <td className="px-4 py-3"><Badge variant="info">{TIER_LABELS[item.minAccessTier]}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.isPublished ? "success" : "neutral"}>
                      {item.isPublished ? "Опубликован" : "Черновик"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{item.viewCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

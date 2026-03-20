import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkKnowledgeBaseAccess } from "@/lib/access";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Материал — ARTWEB" };

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Документ",
  TEMPLATE: "Шаблон",
  WEBINAR_RECORDING: "Запись вебинара",
};

export default async function StudentKBItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { slug } = await params;

  const item = await prisma.knowledgeItem.findUnique({
    where: { slug },
    include: { attachments: { orderBy: { sortOrder: "asc" } } },
  });

  if (!item || !item.isPublished) notFound();

  const hasAccess = await checkKnowledgeBaseAccess(auth.userId, item.id);
  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-700 font-medium mb-2">Доступ закрыт</p>
          <p className="text-sm text-amber-600 mb-4">
            Для просмотра этого материала необходим более высокий уровень доступа.
          </p>
          <Link href="/knowledge-base" className="inline-flex items-center rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-100">
            &larr; К базе знаний
          </Link>
        </div>
      </div>
    );
  }

  // Increment view count (fire-and-forget)
  prisma.knowledgeItem.update({ where: { id: item.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/knowledge-base" className="hover:text-gray-600">База знаний</Link>
        <span>/</span>
        <span className="text-gray-600">{item.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="neutral">{TYPE_LABELS[item.type]}</Badge>
          {item.category && <Badge variant="info">{item.category}</Badge>}
          {item.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
        {item.description && (
          <p className="mt-3 text-gray-600">{item.description}</p>
        )}
      </div>

      {/* Video */}
      {item.videoPath && (
        <div className="mb-6 bg-black rounded-xl overflow-hidden">
          {item.videoPath.startsWith("http") ? (
            <iframe src={item.videoPath} className="w-full aspect-video" allowFullScreen allow="autoplay; fullscreen" />
          ) : (
            <video src={item.videoPath} controls className="w-full aspect-video" />
          )}
        </div>
      )}

      {/* Content */}
      {item.content && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="prose prose-gray max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {item.content}
          </div>
        </div>
      )}

      {/* File download */}
      {item.filePath && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Файл</h2>
          <a
            href={item.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Скачать / Открыть
          </a>
        </div>
      )}

      {/* Attachments */}
      {item.attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Дополнительные файлы</h2>
          <div className="space-y-2">
            {item.attachments.map((att) => (
              <a
                key={att.id}
                href={att.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5 hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-700">{att.fileName}</span>
                {att.fileSize && (
                  <span className="text-xs text-gray-400">{Math.round(att.fileSize / 1024)} КБ</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <Link href="/knowledge-base" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        &larr; Вернуться к базе знаний
      </Link>
    </div>
  );
}

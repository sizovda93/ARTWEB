import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { KBForm } from "../kb-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Материал — ARTWEB Admin" };

export default async function EditKBPage({ params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const { id } = await params;
  const item = await prisma.knowledgeItem.findUnique({ where: { id } });
  if (!item) notFound();

  const initial = {
    id: item.id,
    title: item.title,
    slug: item.slug,
    type: item.type,
    description: item.description,
    content: item.content,
    category: item.category,
    tags: item.tags,
    minAccessTier: item.minAccessTier,
    isPublished: item.isPublished,
    filePath: item.filePath,
    videoPath: item.videoPath,
  };

  return (
    <>
      <PageHeader
        title={item.title}
        description={item.slug}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={item.isPublished ? "success" : "neutral"}>
              {item.isPublished ? "Опубликован" : "Черновик"}
            </Badge>
            <Link href="/admin/knowledge-base" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              &larr; К списку
            </Link>
          </div>
        }
      />
      <KBForm mode="edit" initial={initial} />
    </>
  );
}

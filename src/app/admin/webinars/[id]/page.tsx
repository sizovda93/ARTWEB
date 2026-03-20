import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { WebinarForm } from "../webinar-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Вебинар — ARTWEB Admin" };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  SCHEDULED: { label: "Запланирован", variant: "info" },
  LIVE: { label: "В эфире", variant: "success" },
  ENDED: { label: "Завершён", variant: "neutral" },
  CANCELLED: { label: "Отменён", variant: "error" },
};

export default async function EditWebinarPage({ params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({
    where: { id },
    include: { _count: { select: { attendances: true } } },
  });
  if (!webinar) notFound();

  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  const sc = STATUS_CONFIG[webinar.status] ?? { label: webinar.status, variant: "neutral" as const };

  const initial = {
    id: webinar.id,
    title: webinar.title,
    slug: webinar.slug,
    description: webinar.description ?? "",
    scheduledAt: new Date(webinar.scheduledAt).toISOString().slice(0, 16),
    streamUrl: webinar.streamUrl ?? "",
    recordingPath: webinar.recordingPath ?? "",
    isPublic: webinar.isPublic,
    courseId: webinar.courseId ?? "",
    coverPath: webinar.coverPath ?? "",
    status: webinar.status,
  };

  return (
    <>
      <PageHeader
        title={webinar.title}
        description={`Участники: ${webinar._count.attendances}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={sc.variant}>{sc.label}</Badge>
            <Link href="/admin/webinars" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">&larr; К списку</Link>
          </div>
        }
      />
      <WebinarForm mode="edit" initial={initial} courses={courses} />
    </>
  );
}

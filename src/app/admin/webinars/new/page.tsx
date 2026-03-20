import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { WebinarForm } from "../webinar-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новый вебинар — ARTWEB Admin" };

export default async function NewWebinarPage() {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <>
      <PageHeader title="Новый вебинар" actions={
        <Link href="/admin/webinars" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">&larr; К списку</Link>
      } />
      <WebinarForm mode="create" courses={courses} />
    </>
  );
}

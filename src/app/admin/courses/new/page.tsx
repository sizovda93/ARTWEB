import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { CourseCreateForm } from "./course-create-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Новый курс — ARTWEB Admin",
};

export default async function NewCoursePage() {
  try {
    await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  return (
    <>
      <PageHeader
        title="Новый курс"
        actions={
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            &larr; К списку
          </Link>
        }
      />
      <CourseCreateForm />
    </>
  );
}

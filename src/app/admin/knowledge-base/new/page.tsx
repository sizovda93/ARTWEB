import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KBForm } from "../kb-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новый материал — ARTWEB Admin" };

export default async function NewKBPage() {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  return (
    <>
      <PageHeader
        title="Новый материал"
        actions={
          <Link href="/admin/knowledge-base" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            &larr; К списку
          </Link>
        }
      />
      <KBForm mode="create" />
    </>
  );
}

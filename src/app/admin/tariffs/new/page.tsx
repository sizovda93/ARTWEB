import { redirect } from "next/navigation";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { TariffForm } from "../tariff-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Новый тариф — ARTWEB Admin",
};

export default async function NewTariffPage() {
  try {
    await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  return (
    <>
      <PageHeader title="Новый тариф" />
      <TariffForm mode="create" />
    </>
  );
}

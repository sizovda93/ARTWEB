import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { TariffForm, type TariffFormData } from "../tariff-form";
import { TariffCourses } from "./tariff-courses";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тариф — ARTWEB Admin",
};

export default async function TariffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const { id } = await params;

  const tariff = await prisma.tariff.findUnique({
    where: { id },
    include: {
      tariffFeatures: true,
      tariffCourses: {
        include: {
          course: { select: { id: true, title: true, slug: true, isPublished: true } },
        },
      },
      _count: { select: { accessGrants: { where: { isActive: true } } } },
    },
  });

  if (!tariff) notFound();

  // All courses for the link dropdown (exclude already linked)
  const linkedCourseIds = tariff.tariffCourses.map((tc) => tc.courseId);
  const availableCourses = await prisma.course.findMany({
    where: linkedCourseIds.length > 0 ? { id: { notIn: linkedCourseIds } } : {},
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });

  const formData: TariffFormData = {
    id: tariff.id,
    name: tariff.name,
    slug: tariff.slug,
    tier: tariff.tier,
    description: tariff.description ?? "",
    price: Number(tariff.price),
    oldPrice: tariff.oldPrice ? Number(tariff.oldPrice) : null,
    currency: tariff.currency,
    isActive: tariff.isActive,
    sortOrder: tariff.sortOrder,
    features: tariff.tariffFeatures.map((f) => ({
      feature: f.feature,
      config: (f.config as Record<string, unknown>) ?? undefined,
    })),
  };

  const linkedCourses = tariff.tariffCourses.map((tc) => ({
    id: tc.course.id,
    title: tc.course.title,
    slug: tc.course.slug,
    isPublished: tc.course.isPublished,
  }));

  return (
    <>
      <PageHeader
        title={tariff.name}
        description={`${tariff.slug} · Активных доступов: ${tariff._count.accessGrants}`}
        actions={
          <Link
            href="/admin/tariffs"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            &larr; К списку
          </Link>
        }
      />

      <div className="space-y-6">
        <SectionCard title="Редактирование тарифа">
          <TariffForm initial={formData} mode="edit" />
        </SectionCard>

        <SectionCard title="Привязанные курсы">
          <TariffCourses
            tariffId={tariff.id}
            linkedCourses={linkedCourses}
            availableCourses={availableCourses}
          />
        </SectionCard>
      </div>
    </>
  );
}

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { CourseBuilder } from "./course-builder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Курс — ARTWEB Admin",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === "NOT_AUTHENTICATED" || e.code === "TOKEN_EXPIRED" || e.code === "TOKEN_INVALID") {
        redirect("/login");
      }
      redirect("/");
    }
    throw e;
  }

  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              isFree: true,
              sortOrder: true,
              videoPath: true,
              requiresAssignment: true,
            },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const serialized = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    coverPath: course.coverPath,
    isPublished: course.isPublished,
    sortOrder: course.sortOrder,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      lessons: m.lessons,
    })),
  };

  return (
    <>
      <PageHeader
        title={course.title}
        description={course.slug}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={course.isPublished ? "success" : "neutral"}>
              {course.isPublished ? "Опубликован" : "Черновик"}
            </Badge>
            <Link
              href="/admin/courses"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              &larr; К списку
            </Link>
          </div>
        }
      />
      <CourseBuilder initial={serialized} />
    </>
  );
}

import { Suspense } from "react";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { UsersFilters } from "./users-filters";
import { UsersTable } from "./users-table";
import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Пользователи — ARTWEB Admin",
};

const PER_PAGE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthContext();
  if (!auth || auth.role !== "ADMIN") redirect("/");

  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : "";
  const roleFilter = typeof params.role === "string" ? params.role : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(params.page) || 1);

  // Build where clause
  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }
  if (roleFilter === "ADMIN" || roleFilter === "STUDENT") {
    where.role = roleFilter;
  }
  if (statusFilter === "active") where.isActive = true;
  if (statusFilter === "inactive") where.isActive = false;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        partnerProfile: {
          select: { isApproved: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);

  const serialized = users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isActive: u.isActive,
    emailVerified: u.emailVerified,
    isPartner: u.partnerProfile?.isApproved ?? false,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Пользователи"
        description={`Всего: ${total}`}
      />
      <Suspense>
        <UsersFilters />
      </Suspense>
      <UsersTable
        users={serialized}
        currentPage={page}
        totalPages={totalPages}
        currentUserId={auth.userId}
      />
    </>
  );
}

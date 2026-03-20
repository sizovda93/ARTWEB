import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "./user-actions";
import { UserAccessGrants } from "./user-access-grants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пользователь — ARTWEB Admin",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let auth;
  try {
    auth = await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) {
      if (
        e.code === "NOT_AUTHENTICATED" ||
        e.code === "TOKEN_EXPIRED" ||
        e.code === "TOKEN_INVALID"
      ) {
        redirect("/login");
      }
      redirect("/");
    }
    throw e;
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      partnerProfile: {
        select: {
          referralCode: true,
          commissionRate: true,
          totalEarnings: true,
          pendingPayout: true,
          isApproved: true,
        },
      },
      _count: {
        select: {
          sessions: true,
          purchases: true,
          accessGrants: true,
        },
      },
    },
  });

  if (!user) notFound();

  // Courses for access grant dropdown
  const allCourses = await prisma.course.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  const isSelf = user.id === auth.userId;

  return (
    <>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
        actions={
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            &larr; К списку
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Основная информация">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <InfoRow label="Имя" value={user.firstName} />
              <InfoRow label="Фамилия" value={user.lastName} />
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Телефон" value={user.phone || "—"} />
              <InfoRow
                label="Дата регистрации"
                value={new Date(user.createdAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <InfoRow
                label="Обновлён"
                value={new Date(user.updatedAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Статус аккаунта">
            <div className="flex flex-wrap gap-3">
              <StatusItem label="Роль">
                <Badge variant={user.role === "ADMIN" ? "info" : "neutral"}>
                  {user.role === "ADMIN" ? "Admin" : "Student"}
                </Badge>
              </StatusItem>
              <StatusItem label="Статус">
                <Badge variant={user.isActive ? "success" : "error"}>
                  {user.isActive ? "Активен" : "Неактивен"}
                </Badge>
              </StatusItem>
              <StatusItem label="Email">
                <Badge variant={user.emailVerified ? "success" : "warning"}>
                  {user.emailVerified ? "Подтверждён" : "Не подтверждён"}
                </Badge>
              </StatusItem>
              <StatusItem label="Партнёр">
                {user.partnerProfile?.isApproved ? (
                  <Badge variant="success">Партнёр</Badge>
                ) : (
                  <Badge variant="neutral">Нет</Badge>
                )}
              </StatusItem>
            </div>
          </SectionCard>

          {user.partnerProfile && (
            <SectionCard title="Партнёрский профиль">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <InfoRow
                  label="Реферальный код"
                  value={user.partnerProfile.referralCode}
                />
                <InfoRow
                  label="Комиссия"
                  value={`${(Number(user.partnerProfile.commissionRate) * 100).toFixed(0)}%`}
                />
                <InfoRow
                  label="Всего заработано"
                  value={`${Number(user.partnerProfile.totalEarnings).toLocaleString("ru-RU")} ₽`}
                />
                <InfoRow
                  label="К выплате"
                  value={`${Number(user.partnerProfile.pendingPayout).toLocaleString("ru-RU")} ₽`}
                />
                <InfoRow
                  label="Статус"
                  value={
                    user.partnerProfile.isApproved
                      ? "Подтверждён"
                      : "Не подтверждён"
                  }
                />
              </dl>
            </SectionCard>
          )}

          <SectionCard title="Доступы">
            <UserAccessGrants userId={user.id} courses={allCourses} />
          </SectionCard>
        </div>

        {/* Right column: stats + actions */}
        <div className="space-y-6">
          <SectionCard title="Сводка">
            <dl className="space-y-3 text-sm">
              <SummaryRow
                label="Активные сессии"
                value={user._count.sessions}
              />
              <SummaryRow label="Покупки" value={user._count.purchases} />
              <SummaryRow label="Доступы" value={user._count.accessGrants} />
            </dl>
          </SectionCard>

          <SectionCard title="Действия">
            <UserActions
              userId={user.id}
              isActive={user.isActive}
              role={user.role}
              isPartner={user.partnerProfile?.isApproved ?? false}
              isSelf={isSelf}
            />
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function StatusItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}:</span>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

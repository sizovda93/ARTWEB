import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Панель администратора — ARTWEB",
};

export default async function AdminDashboardPage() {
  const auth = await getAuthContext();
  if (!auth || auth.role !== "ADMIN") redirect("/");

  // Live DB counts
  const [usersCount, coursesCount, activeSessionsCount] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Панель администратора"
        description="Обзор платформы"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Пользователей" value={usersCount} />
        <StatCard label="Курсов" value={coursesCount} />
        <StatCard label="Активных сессий" value={activeSessionsCount} />
        <StatCard label="Вебинаров" value={0} description="Модуль в разработке" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Последние регистрации">
          <EmptyState message="Данные будут доступны после подключения модуля" />
        </SectionCard>
        <SectionCard title="Последняя активность">
          <EmptyState message="Данные будут доступны после подключения модуля" />
        </SectionCard>
      </div>
    </>
  );
}

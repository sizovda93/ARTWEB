import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Дашборд — ARTWEB",
};

export default async function DashboardPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { firstName: true },
  });

  return (
    <>
      <PageHeader
        title={`Добро пожаловать, ${user?.firstName ?? "Студент"}`}
        description="Ваш прогресс и предстоящие события"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Мои курсы" value={0} description="Нет активных курсов" />
        <StatCard label="Завершено уроков" value={0} description="Начните обучение" />
        <StatCard label="Предстоящие вебинары" value={0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Мои курсы">
          <EmptyState
            message="У вас пока нет курсов"
            description="Курсы появятся здесь после покупки"
          />
        </SectionCard>
        <SectionCard title="Предстоящие вебинары">
          <EmptyState
            message="Нет предстоящих вебинаров"
            description="Расписание будет обновлено"
          />
        </SectionCard>
      </div>
    </>
  );
}

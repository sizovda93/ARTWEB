import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/app-shell";
import { studentNavItems } from "@/lib/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) redirect("/login");

  return (
    <AppShell
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: auth.role,
        emailVerified: auth.emailVerified,
      }}
      navItems={studentNavItems}
    >
      {children}
    </AppShell>
  );
}

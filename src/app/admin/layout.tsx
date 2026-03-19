import { redirect } from "next/navigation";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/app-shell";
import { adminNavItems } from "@/lib/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // DB-fresh admin check: verifies role + isActive directly in DB.
  // Closes the 15-min JWT staleness window for revoked admins.
  let auth;
  try {
    auth = await requireAdminFresh();
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === "NOT_AUTHENTICATED" || e.code === "TOKEN_EXPIRED" || e.code === "TOKEN_INVALID") {
        redirect("/login");
      }
      // FORBIDDEN (role revoked) or USER_INACTIVE → landing
      redirect("/");
    }
    throw e;
  }

  // auth.role and auth.emailVerified are now DB-fresh (not JWT-cached)
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
      navItems={adminNavItems}
    >
      {children}
    </AppShell>
  );
}

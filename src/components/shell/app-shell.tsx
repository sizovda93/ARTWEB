import { Sidebar } from "./sidebar";
import { EmailVerifyBanner } from "@/components/auth/email-verify-banner";
import type { NavItem } from "@/lib/navigation";

export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "STUDENT";
  emailVerified: boolean;
}

interface AppShellProps {
  user: ShellUser;
  navItems: NavItem[];
  children: React.ReactNode;
}

export function AppShell({ user, navItems, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} navItems={navItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {!user.emailVerified && (
          <div className="shrink-0 px-6 pt-4">
            <EmailVerifyBanner />
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

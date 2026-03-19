"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import type { NavItem } from "@/lib/navigation";

interface SidebarUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface SidebarProps {
  user: SidebarUser;
  navItems: NavItem[];
}

export function Sidebar({ user, navItems }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";

  async function handleLogout() {
    await apiClient("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Link
          href={isAdmin ? "/admin/dashboard" : "/dashboard"}
          className="flex items-center gap-2"
        >
          <span className="text-xl font-bold text-gray-900">ARTWEB</span>
          {isAdmin && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? isAdmin
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${
              isAdmin ? "bg-indigo-500" : "bg-blue-500"
            }`}
          >
            {user.firstName[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full text-left text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}

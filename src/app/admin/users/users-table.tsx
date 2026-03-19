"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "STUDENT";
  isActive: boolean;
  emailVerified: boolean;
  isPartner: boolean;
  createdAt: string;
}

interface UsersTableProps {
  users: UserRow[];
  currentPage: number;
  totalPages: number;
  currentUserId: string;
}

const CONFIRM_MESSAGES: Record<string, string> = {
  deactivate: "Деактивировать пользователя? Все его сессии будут завершены.",
  set_role: "Изменить роль? Все сессии пользователя будут завершены.",
  terminate_sessions: "Завершить все активные сессии пользователя?",
};

export function UsersTable({
  users,
  currentPage,
  totalPages,
  currentUserId,
}: UsersTableProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const menuRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAction(
    userId: string,
    type: string,
    data?: Record<string, unknown>,
  ) {
    const msg = CONFIRM_MESSAGES[type];
    if (msg && !window.confirm(msg)) return;

    setLoading(userId);
    setOpenMenu(null);

    const result = await apiClient(`/api/admin/users/${userId}/action`, {
      method: "POST",
      body: JSON.stringify({ type, ...data }),
    });

    setLoading(null);

    if (!result.ok) {
      alert(result.error.message);
      return;
    }

    router.refresh();
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
        Пользователи не найдены
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">
                Пользователь
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Роль</th>
              <th className="px-4 py-3 font-medium text-gray-600">Статус</th>
              <th className="px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 font-medium text-gray-600">Партнёр</th>
              <th className="px-4 py-3 font-medium text-gray-600">Дата</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isMenuOpen = openMenu === user.id;
              const isLoading = loading === user.id;

              return (
                <tr
                  key={user.id}
                  className={`hover:bg-gray-50 transition-colors ${isLoading ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="hover:text-indigo-600"
                    >
                      <p className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-gray-500 text-xs">{user.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === "ADMIN" ? "info" : "neutral"}>
                      {user.role === "ADMIN" ? "Admin" : "Student"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.isActive ? "success" : "error"}>
                      {user.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.emailVerified ? "success" : "warning"}
                    >
                      {user.emailVerified ? "Подтверждён" : "Не подтверждён"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.isPartner ? (
                      <Badge variant="success">Партнёр</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3 relative" ref={isMenuOpen ? menuRef : undefined}>
                    <button
                      onClick={() =>
                        setOpenMenu(isMenuOpen ? null : user.id)
                      }
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      disabled={isLoading}
                    >
                      &#x22EE;
                    </button>
                    {isMenuOpen && (
                      <div className="absolute right-4 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                        {!isSelf && (
                          <>
                            <MenuButton
                              onClick={() =>
                                handleAction(
                                  user.id,
                                  user.isActive ? "deactivate" : "activate",
                                )
                              }
                            >
                              {user.isActive
                                ? "Деактивировать"
                                : "Активировать"}
                            </MenuButton>
                            <MenuButton
                              onClick={() =>
                                handleAction(user.id, "set_role", {
                                  role:
                                    user.role === "ADMIN"
                                      ? "STUDENT"
                                      : "ADMIN",
                                })
                              }
                            >
                              {user.role === "ADMIN"
                                ? "Снять Admin"
                                : "Назначить Admin"}
                            </MenuButton>
                          </>
                        )}
                        <MenuButton
                          onClick={() =>
                            handleAction(user.id, "set_partner", {
                              approved: !user.isPartner,
                            })
                          }
                        >
                          {user.isPartner
                            ? "Отозвать партнёра"
                            : "Подтвердить партнёра"}
                        </MenuButton>
                        <MenuButton
                          onClick={() =>
                            handleAction(user.id, "terminate_sessions")
                          }
                        >
                          Завершить сессии
                        </MenuButton>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Suspense>
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </Suspense>
    </>
  );
}

function MenuButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

interface UserActionsProps {
  userId: string;
  isActive: boolean;
  role: "ADMIN" | "STUDENT";
  isPartner: boolean;
  isSelf: boolean;
}

const CONFIRM_MESSAGES: Record<string, string> = {
  deactivate: "Деактивировать пользователя? Все его сессии будут завершены.",
  set_role: "Изменить роль? Все сессии пользователя будут завершены.",
  terminate_sessions: "Завершить все активные сессии пользователя?",
};

export function UserActions({
  userId,
  isActive,
  role,
  isPartner,
  isSelf,
}: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(
    type: string,
    data?: Record<string, unknown>,
  ) {
    const msg = CONFIRM_MESSAGES[type];
    if (msg && !window.confirm(msg)) return;

    setLoading(true);

    const result = await apiClient(`/api/admin/users/${userId}/action`, {
      method: "POST",
      body: JSON.stringify({ type, ...data }),
    });

    setLoading(false);

    if (!result.ok) {
      alert(result.error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className={`space-y-2 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
      {!isSelf && (
        <>
          <ActionButton
            onClick={() =>
              handleAction(isActive ? "deactivate" : "activate")
            }
            variant={isActive ? "danger" : "success"}
          >
            {isActive ? "Деактивировать" : "Активировать"}
          </ActionButton>

          <ActionButton
            onClick={() =>
              handleAction("set_role", {
                role: role === "ADMIN" ? "STUDENT" : "ADMIN",
              })
            }
            variant="default"
          >
            {role === "ADMIN" ? "Снять Admin" : "Назначить Admin"}
          </ActionButton>
        </>
      )}

      <ActionButton
        onClick={() =>
          handleAction("set_partner", { approved: !isPartner })
        }
        variant="default"
      >
        {isPartner ? "Отозвать партнёра" : "Подтвердить партнёра"}
      </ActionButton>

      <ActionButton
        onClick={() => handleAction("terminate_sessions")}
        variant="warning"
      >
        Завершить сессии
      </ActionButton>
    </div>
  );
}

const BUTTON_STYLES = {
  default:
    "border-gray-300 text-gray-700 hover:bg-gray-50",
  danger:
    "border-red-300 text-red-700 hover:bg-red-50",
  warning:
    "border-amber-300 text-amber-700 hover:bg-amber-50",
  success:
    "border-green-300 text-green-700 hover:bg-green-50",
} as const;

function ActionButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: keyof typeof BUTTON_STYLES;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${BUTTON_STYLES[variant]}`}
    >
      {children}
    </button>
  );
}

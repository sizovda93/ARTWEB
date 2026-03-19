"use client";

import { apiClient } from "@/lib/api-client";

export function LogoutButton() {
  async function handleLogout() {
    await apiClient("/api/auth/logout", { method: "POST" });
    // Full page reload to clear all client state
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      Выйти
    </button>
  );
}

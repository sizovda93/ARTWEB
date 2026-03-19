"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function UsersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function updateUrl(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateUrl("search", value);
    }, 400);
  }

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <input
        type="text"
        placeholder="Поиск по имени, email или телефону..."
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      <select
        value={searchParams.get("role") ?? ""}
        onChange={(e) => updateUrl("role", e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      >
        <option value="">Все роли</option>
        <option value="ADMIN">Admin</option>
        <option value="STUDENT">Student</option>
      </select>
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateUrl("status", e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      >
        <option value="">Все статусы</option>
        <option value="active">Активные</option>
        <option value="inactive">Неактивные</option>
      </select>
    </div>
  );
}

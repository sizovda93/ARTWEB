"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

const INPUT =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

interface ModuleData {
  id: string;
  title: string;
  lessons: { id: string }[];
}

export function ModuleEditor({
  courseId,
  module: mod,
  onSave,
  onDelete,
}: {
  courseId: string;
  module: ModuleData;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(mod.title);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    const result = await apiClient(
      `/api/admin/courses/${courseId}/modules/${mod.id}`,
      { method: "PUT", body: JSON.stringify({ title: title.trim() }) },
    );

    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSave();
  }

  async function handleDelete() {
    const lessonsCount = mod.lessons.length;
    const msg = lessonsCount > 0
      ? `Удалить модуль "${mod.title}" и все ${lessonsCount} урок(ов)?`
      : `Удалить модуль "${mod.title}"?`;
    if (!window.confirm(msg)) return;

    setLoading(true);
    const result = await apiClient(
      `/api/admin/courses/${courseId}/modules/${mod.id}`,
      { method: "DELETE" },
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onDelete();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Модуль</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT}
            required
          />
        </div>

        <div className="text-sm text-gray-500">
          Уроков: {mod.lessons.length}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg border border-red-300 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Удалить модуль
          </button>
        </div>
      </form>
    </div>
  );
}

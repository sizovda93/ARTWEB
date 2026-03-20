"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

interface CourseInfo {
  id: string;
  title: string;
  slug: string;
  isPublished?: boolean;
}

interface TariffCoursesProps {
  tariffId: string;
  linkedCourses: CourseInfo[];
  availableCourses: CourseInfo[];
}

export function TariffCourses({
  tariffId,
  linkedCourses,
  availableCourses,
}: TariffCoursesProps) {
  const router = useRouter();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (!selectedCourseId) return;
    setLoading("link");
    setError(null);

    const result = await apiClient(`/api/admin/tariffs/${tariffId}/courses`, {
      method: "POST",
      body: JSON.stringify({ courseId: selectedCourseId }),
    });

    setLoading(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSelectedCourseId("");
    router.refresh();
  }

  async function handleUnlink(courseId: string) {
    if (!window.confirm("Отвязать курс от тарифа?")) return;
    setLoading(courseId);
    setError(null);

    const result = await apiClient(`/api/admin/tariffs/${tariffId}/courses`, {
      method: "DELETE",
      body: JSON.stringify({ courseId }),
    });

    setLoading(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  const isLoading = loading !== null;

  return (
    <div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Linked courses list */}
      {linkedCourses.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">Курсы не привязаны</p>
      ) : (
        <div className="space-y-2 mb-4">
          {linkedCourses.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{c.title}</span>
                <span className="text-xs text-gray-400">{c.slug}</span>
                {c.isPublished !== undefined && (
                  <Badge variant={c.isPublished ? "success" : "neutral"}>
                    {c.isPublished ? "Опубликован" : "Черновик"}
                  </Badge>
                )}
              </div>
              <button
                onClick={() => handleUnlink(c.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Отвязать
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add course */}
      {availableCourses.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="">Выберите курс...</option>
            {availableCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.slug})
              </option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={!selectedCourseId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Привязать
          </button>
        </div>
      )}

      {availableCourses.length === 0 && linkedCourses.length > 0 && (
        <p className="text-xs text-gray-400">Все доступные курсы уже привязаны</p>
      )}
    </div>
  );
}

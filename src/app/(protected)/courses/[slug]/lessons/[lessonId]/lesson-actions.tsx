"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

export function LessonActions({
  courseId,
  courseSlug,
  lessonId,
  isCompleted: initialCompleted,
  prevLessonId,
  prevLessonTitle,
  nextLessonId,
  nextLessonTitle,
}: {
  courseId: string;
  courseSlug: string;
  lessonId: string;
  isCompleted: boolean;
  prevLessonId: string | null;
  prevLessonTitle: string | null;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    setLoading(true);
    const result = await apiClient(
      `/api/courses/${courseId}/lessons/${lessonId}/complete`,
      { method: "POST" },
    );
    setLoading(false);

    if (result.ok) {
      setCompleted(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {/* Mark complete */}
      {!completed && (
        <button
          type="button"
          onClick={handleComplete}
          disabled={loading}
          className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Сохранение..." : "Отметить урок пройденным"}
        </button>
      )}

      {completed && (
        <div className="w-full rounded-xl bg-green-50 border border-green-200 px-6 py-3 text-center text-sm font-medium text-green-700">
          Урок пройден &#10003;
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        {prevLessonId ? (
          <Link
            href={`/courses/${courseSlug}/lessons/${prevLessonId}`}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs text-gray-400 block">&larr; Предыдущий</span>
            <span className="font-medium text-gray-700 line-clamp-1">{prevLessonTitle}</span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {nextLessonId ? (
          <Link
            href={`/courses/${courseSlug}/lessons/${nextLessonId}`}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-right text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs text-gray-400 block">Следующий &rarr;</span>
            <span className="font-medium text-gray-700 line-clamp-1">{nextLessonTitle}</span>
          </Link>
        ) : (
          <Link
            href={`/courses/${courseSlug}`}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-right text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs text-gray-400 block">Завершить</span>
            <span className="font-medium text-gray-700">К содержанию курса</span>
          </Link>
        )}
      </div>
    </div>
  );
}

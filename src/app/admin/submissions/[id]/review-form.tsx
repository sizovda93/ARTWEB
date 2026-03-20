"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function ReviewForm({
  submissionId,
  currentStatus,
  currentScore,
  currentComment,
  maxScore,
}: {
  submissionId: string;
  currentStatus: string;
  currentScore: number | null;
  currentComment: string | null;
  maxScore: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [score, setScore] = useState(currentScore?.toString() ?? "");
  const [comment, setComment] = useState(currentComment ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleReview(reviewStatus: "APPROVED" | "REJECTED" | "REVISION_REQUESTED") {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await apiClient(`/api/admin/submissions/${submissionId}/review`, {
      method: "POST",
      body: JSON.stringify({
        status: reviewStatus,
        finalScore: score ? Number(score) : null,
        finalComment: comment.trim() || null,
      }),
    });

    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }

    setStatus(reviewStatus);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
      <h3 className="font-semibold text-gray-900 mb-4">Проверка</h3>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Сохранено</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Балл (макс. {maxScore})</label>
          <input
            type="number"
            min={0}
            max={maxScore}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className={INPUT}
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className={INPUT}
            placeholder="Комментарий к работе..."
          />
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => handleReview("APPROVED")}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Принять
          </button>
          <button
            type="button"
            onClick={() => handleReview("REVISION_REQUESTED")}
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            На доработку
          </button>
          <button
            type="button"
            onClick={() => handleReview("REJECTED")}
            disabled={loading}
            className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Отклонить
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Текущий статус: {status}
        </p>
      </div>
    </div>
  );
}

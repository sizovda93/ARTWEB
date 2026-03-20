"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

interface OptionData {
  id: string;
  text: string;
}

interface QuestionData {
  id: string;
  text: string;
  isMultiSelect: boolean;
  options: OptionData[];
}

interface SubmissionData {
  id: string;
  status: string;
  textAnswer: string | null;
  finalScore: number | null;
  finalComment: string | null;
  testAnswers: Record<string, string[]> | null;
  createdAt: string;
}

interface AssignmentData {
  id: string;
  title: string;
  description: string | null;
  type: "TEXT" | "FILE_UPLOAD" | "TEST";
  maxScore: number;
  questions: QuestionData[];
  submission: SubmissionData | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  PENDING: { label: "На проверке", variant: "warning" },
  AI_REVIEWED: { label: "AI проверено", variant: "info" },
  APPROVED: { label: "Принято", variant: "success" },
  REJECTED: { label: "Не принято", variant: "error" },
  REVISION_REQUESTED: { label: "Доработка", variant: "warning" },
};

export function LessonAssignments({
  courseId,
  assignments,
}: {
  courseId: string;
  assignments: AssignmentData[];
}) {
  if (assignments.length === 0) return null;

  return (
    <div className="space-y-4">
      {assignments.map((a) => (
        <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{a.title}</h3>
            {a.submission && (
              <Badge variant={STATUS_LABELS[a.submission.status]?.variant ?? "neutral"}>
                {STATUS_LABELS[a.submission.status]?.label ?? a.submission.status}
              </Badge>
            )}
          </div>
          {a.description && <p className="text-sm text-gray-500 mb-3">{a.description}</p>}

          {a.type === "TEXT" && (
            <TextAssignment courseId={courseId} assignment={a} />
          )}
          {a.type === "TEST" && (
            <TestAssignment courseId={courseId} assignment={a} />
          )}
          {a.type === "FILE_UPLOAD" && (
            <p className="text-sm text-gray-400">Загрузка файлов будет доступна в следующем обновлении</p>
          )}
        </div>
      ))}
    </div>
  );
}

function TextAssignment({ courseId, assignment }: { courseId: string; assignment: AssignmentData }) {
  const [answer, setAnswer] = useState(assignment.submission?.textAnswer ?? "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(!!assignment.submission);
  const [error, setError] = useState<string | null>(null);

  const canEdit = !assignment.submission || ["REVISION_REQUESTED"].includes(assignment.submission.status);

  async function handleSubmit() {
    if (!answer.trim()) return;
    setLoading(true);
    setError(null);

    const r = await apiClient(`/api/courses/${courseId}/assignments/${assignment.id}`, {
      method: "POST",
      body: JSON.stringify({ textAnswer: answer.trim() }),
    });

    setLoading(false);
    if (!r.ok) { setError(r.error.message); return; }
    setSubmitted(true);
  }

  return (
    <div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={5}
        disabled={!canEdit}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
        placeholder="Ваш ответ..."
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {canEdit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !answer.trim()}
          className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Отправка..." : submitted ? "Отправить заново" : "Отправить"}
        </button>
      )}
      {assignment.submission?.finalScore !== null && assignment.submission?.finalScore !== undefined && (
        <p className="text-sm text-green-600 mt-2">
          Оценка: {assignment.submission.finalScore} / {assignment.maxScore}
        </p>
      )}
      {assignment.submission?.finalComment && (
        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-500 mb-1">Комментарий преподавателя:</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.submission.finalComment}</p>
        </div>
      )}
    </div>
  );
}

function TestAssignment({ courseId, assignment }: { courseId: string; assignment: AssignmentData }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number; passed: boolean } | null>(
    assignment.submission?.finalScore !== null && assignment.submission?.finalScore !== undefined
      ? { score: assignment.submission.finalScore, maxScore: assignment.maxScore, passed: assignment.submission.status === "APPROVED" }
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  const alreadySubmitted = !!assignment.submission && assignment.submission.status !== "REVISION_REQUESTED";

  function toggleOption(questionId: string, optionId: string, isMulti: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (isMulti) {
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const r = await apiClient<{ submission: { score: number; maxScore: number; passed: boolean } }>(
      `/api/courses/${courseId}/assignments/${assignment.id}`,
      { method: "POST", body: JSON.stringify({ answers }) },
    );

    setLoading(false);
    if (!r.ok) { setError(r.error.message); return; }
    setResult(r.data.submission);
  }

  return (
    <div>
      {result && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${result.passed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {result.passed ? "Тест пройден" : "Тест не пройден"}: {result.score} / {result.maxScore}
        </div>
      )}

      {!alreadySubmitted && (
        <>
          <div className="space-y-4">
            {assignment.questions.map((q, qi) => (
              <div key={q.id} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  {qi + 1}. {q.text}
                  {q.isMultiSelect && <span className="text-xs text-gray-400 ml-1">(несколько)</span>}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const selected = (answers[q.id] ?? []).includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type={q.isMultiSelect ? "checkbox" : "radio"}
                          name={`q-${q.id}`}
                          checked={selected}
                          onChange={() => toggleOption(q.id, opt.id, q.isMultiSelect)}
                          className="border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Проверка..." : "Отправить ответы"}
          </button>
        </>
      )}
    </div>
  );
}

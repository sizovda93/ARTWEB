"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

interface QuestionData {
  id: string;
  text: string;
  explanation: string | null;
  isMultiSelect: boolean;
  options: { id: string; text: string; isCorrect: boolean }[];
}

interface AssignmentData {
  id: string;
  title: string;
  description: string | null;
  type: "TEXT" | "FILE_UPLOAD" | "TEST";
  maxScore: number;
  isRequired: boolean;
  questions: QuestionData[];
  _count: { submissions: number };
}

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Текст",
  FILE_UPLOAD: "Файл",
  TEST: "Тест",
};

export function AssignmentEditor({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/courses/${courseId}/lessons/${lessonId}/assignments`;

  const fetch_ = useCallback(async () => {
    const r = await apiClient<{ assignments: AssignmentData[] }>(base);
    if (r.ok) setAssignments(r.data.assignments);
    setLoading(false);
  }, [base]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function addAssignment(type: "TEXT" | "TEST") {
    const title = window.prompt(`Название задания (${TYPE_LABELS[type]}):`);
    if (!title?.trim()) return;

    setError(null);
    const r = await apiClient(base, {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), type }),
    });
    if (!r.ok) { setError(r.error.message); return; }
    fetch_();
  }

  async function deleteAssignment(id: string) {
    if (!window.confirm("Удалить задание?")) return;
    await apiClient(`${base}/${id}`, { method: "DELETE" });
    fetch_();
  }

  async function addQuestion(assignmentId: string) {
    const text = window.prompt("Текст вопроса:");
    if (!text?.trim()) return;

    const r = await apiClient(`${base}/${assignmentId}/questions`, {
      method: "POST",
      body: JSON.stringify({
        text: text.trim(),
        isMultiSelect: false,
        options: [
          { text: "Вариант 1", isCorrect: true },
          { text: "Вариант 2", isCorrect: false },
        ],
      }),
    });
    if (!r.ok) setError(r.error.message);
    else fetch_();
  }

  async function updateQuestion(questionId: string, data: { text?: string; options?: { text: string; isCorrect: boolean }[] }) {
    const r = await apiClient(`${base}/placeholder/questions/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!r.ok) setError(r.error.message);
    else fetch_();
  }

  async function deleteQuestion(questionId: string) {
    if (!window.confirm("Удалить вопрос?")) return;
    // Use any assignment route — questionId is unique
    for (const a of assignments) {
      for (const q of a.questions) {
        if (q.id === questionId) {
          await apiClient(`${base}/${a.id}/questions/${questionId}`, { method: "DELETE" });
          fetch_();
          return;
        }
      }
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Загрузка заданий...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Задания</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => addAssignment("TEXT")} className="text-xs text-indigo-600 hover:text-indigo-800">
            + Текстовое
          </button>
          <button type="button" onClick={() => addAssignment("TEST")} className="text-xs text-indigo-600 hover:text-indigo-800">
            + Тест
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {assignments.length === 0 ? (
        <p className="text-xs text-gray-400">Нет заданий</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-gray-800">{a.title}</span>
                  <span className="ml-2 text-xs text-gray-400">{TYPE_LABELS[a.type]}</span>
                  {a._count.submissions > 0 && (
                    <span className="ml-2 text-xs text-gray-400">({a._count.submissions} ответов)</span>
                  )}
                </div>
                <button type="button" onClick={() => deleteAssignment(a.id)} className="text-xs text-red-500 hover:text-red-700">
                  Удалить
                </button>
              </div>

              {a.description && (
                <p className="text-xs text-gray-500 mb-2">{a.description}</p>
              )}

              {a.type === "TEST" && (
                <div className="mt-2 space-y-2">
                  {a.questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      onUpdate={(data) => updateQuestion(q.id, data)}
                      onDelete={() => deleteQuestion(q.id)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => addQuestion(a.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    + Добавить вопрос
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onUpdate,
  onDelete,
}: {
  question: QuestionData;
  onUpdate: (data: { text?: string; options?: { text: string; isCorrect: boolean }[] }) => void;
  onDelete: () => void;
}) {
  const [options, setOptions] = useState(question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })));
  const [dirty, setDirty] = useState(false);

  function toggleCorrect(idx: number) {
    const next = options.map((o, i) => ({ ...o, isCorrect: i === idx ? !o.isCorrect : (question.isMultiSelect ? o.isCorrect : false) }));
    setOptions(next);
    setDirty(true);
  }

  function updateOptionText(idx: number, text: string) {
    const next = [...options];
    next[idx] = { ...next[idx], text };
    setOptions(next);
    setDirty(true);
  }

  function addOption() {
    setOptions([...options, { text: "", isCorrect: false }]);
    setDirty(true);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
    setDirty(true);
  }

  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-xs font-medium text-gray-700 flex-1">{question.text}</p>
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 ml-2 shrink-0">x</button>
      </div>

      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleCorrect(i)}
              className={`w-4 h-4 shrink-0 rounded border text-xs flex items-center justify-center ${
                opt.isCorrect ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
              }`}
            >
              {opt.isCorrect ? "✓" : ""}
            </button>
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOptionText(i, e.target.value)}
              className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
            />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className="text-xs text-red-400">x</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-1.5">
        <button type="button" onClick={addOption} className="text-xs text-gray-500 hover:text-gray-700">+ Вариант</button>
        {dirty && (
          <button
            type="button"
            onClick={() => { onUpdate({ options: options.filter(o => o.text.trim()) }); setDirty(false); }}
            className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-700"
          >
            Сохранить
          </button>
        )}
      </div>
    </div>
  );
}

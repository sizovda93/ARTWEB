"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface LessonSummary {
  id: string;
  title: string;
  type: string;
  isFree: boolean;
  sortOrder: number;
}

interface ModuleData {
  id: string;
  title: string;
  sortOrder: number;
  lessons: LessonSummary[];
}

type Selection =
  | { type: "course" }
  | { type: "module"; id: string }
  | { type: "lesson"; id: string; moduleId: string };

const TYPE_ICONS: Record<string, string> = {
  VIDEO: "▶",
  TEXT: "¶",
  MIXED: "◈",
};

export function BuilderSidebar({
  courseId,
  modules,
  selection,
  onSelect,
  onMutate,
}: {
  courseId: string;
  modules: ModuleData[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onMutate: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function addModule() {
    const title = window.prompt("Название модуля:");
    if (!title?.trim()) return;

    setLoading(true);
    await apiClient(`/api/admin/courses/${courseId}/modules`, {
      method: "POST",
      body: JSON.stringify({ title: title.trim() }),
    });
    setLoading(false);
    onMutate();
  }

  async function addLesson(moduleId: string) {
    const title = window.prompt("Название урока:");
    if (!title?.trim()) return;

    setLoading(true);
    await apiClient(`/api/admin/courses/${courseId}/lessons`, {
      method: "POST",
      body: JSON.stringify({ moduleId, title: title.trim() }),
    });
    setLoading(false);
    onMutate();
  }

  async function moveModule(moduleId: string, direction: "up" | "down") {
    const ids = modules.map((m) => m.id);
    const idx = ids.indexOf(moduleId);
    if (direction === "up" && idx > 0) {
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    } else if (direction === "down" && idx < ids.length - 1) {
      [ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]];
    } else return;

    setLoading(true);
    await apiClient(`/api/admin/courses/${courseId}/modules/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds: ids }),
    });
    setLoading(false);
    onMutate();
  }

  async function moveLesson(moduleId: string, lessonId: string, direction: "up" | "down") {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const ids = mod.lessons.map((l) => l.id);
    const idx = ids.indexOf(lessonId);
    if (direction === "up" && idx > 0) {
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    } else if (direction === "down" && idx < ids.length - 1) {
      [ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]];
    } else return;

    setLoading(true);
    await apiClient(`/api/admin/courses/${courseId}/lessons/reorder`, {
      method: "PUT",
      body: JSON.stringify({ moduleId, orderedIds: ids }),
    });
    setLoading(false);
    onMutate();
  }

  const isSelected = (type: string, id?: string) => {
    if (type === "course") return selection.type === "course";
    if (type === "module") return selection.type === "module" && selection.id === id;
    if (type === "lesson") return selection.type === "lesson" && selection.id === id;
    return false;
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Course info button */}
      <button
        type="button"
        onClick={() => onSelect({ type: "course" })}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-3 ${
          isSelected("course") ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        Настройки курса
      </button>

      {/* Modules */}
      <div className="space-y-2">
        {modules.map((mod, mi) => (
          <div key={mod.id} className="border border-gray-100 rounded-lg">
            {/* Module header */}
            <div
              className={`flex items-center gap-1 px-3 py-2 rounded-t-lg cursor-pointer ${
                isSelected("module", mod.id) ? "bg-indigo-50" : "hover:bg-gray-50"
              }`}
              onClick={() => onSelect({ type: "module", id: mod.id })}
            >
              <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                {mod.title}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{mod.lessons.length}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); moveModule(mod.id, "up"); }}
                disabled={mi === 0}
                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Вверх"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); moveModule(mod.id, "down"); }}
                disabled={mi === modules.length - 1}
                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Вниз"
              >
                ↓
              </button>
            </div>

            {/* Lessons */}
            <div className="px-2 pb-2">
              {mod.lessons.map((lesson, li) => (
                <div
                  key={lesson.id}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm ${
                    isSelected("lesson", lesson.id)
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                  onClick={() => onSelect({ type: "lesson", id: lesson.id, moduleId: mod.id })}
                >
                  <span className="text-xs opacity-60 w-4 shrink-0">
                    {TYPE_ICONS[lesson.type] ?? "·"}
                  </span>
                  <span className="flex-1 truncate">{lesson.title}</span>
                  {lesson.isFree && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded shrink-0">
                      free
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveLesson(mod.id, lesson.id, "up"); }}
                    disabled={li === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveLesson(mod.id, lesson.id, "down"); }}
                    disabled={li === mod.lessons.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                  >
                    ↓
                  </button>
                </div>
              ))}

              {/* Add lesson */}
              <button
                type="button"
                onClick={() => addLesson(mod.id)}
                className="w-full text-left px-2 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded mt-1"
              >
                + Добавить урок
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add module */}
      <button
        type="button"
        onClick={addModule}
        className="w-full mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
      >
        + Добавить модуль
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

interface ChecklistData {
  id: string;
  title: string;
  items: { id: string; text: string }[];
}

export function ChecklistEditor({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/courses/${courseId}/lessons/${lessonId}/checklists`;

  const fetch_ = useCallback(async () => {
    const r = await apiClient<{ checklists: ChecklistData[] }>(base);
    if (r.ok) setChecklists(r.data.checklists);
    setLoading(false);
  }, [base]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function addChecklist() {
    const title = window.prompt("Название чеклиста:");
    if (!title?.trim()) return;
    const firstItem = window.prompt("Первый пункт:");
    if (!firstItem?.trim()) return;

    setError(null);
    const r = await apiClient(base, {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), items: [firstItem.trim()] }),
    });
    if (!r.ok) { setError(r.error.message); return; }
    fetch_();
  }

  async function deleteChecklist(id: string) {
    if (!window.confirm("Удалить чеклист?")) return;
    await apiClient(`${base}/${id}`, { method: "DELETE" });
    fetch_();
  }

  async function saveItems(checklist: ChecklistData, items: { text: string }[]) {
    const r = await apiClient(`${base}/${checklist.id}`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    if (!r.ok) setError(r.error.message);
    else fetch_();
  }

  if (loading) return <p className="text-sm text-gray-400">Загрузка чеклистов...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Чеклисты</h3>
        <button type="button" onClick={addChecklist} className="text-xs text-indigo-600 hover:text-indigo-800">
          + Добавить
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {checklists.length === 0 ? (
        <p className="text-xs text-gray-400">Нет чеклистов</p>
      ) : (
        <div className="space-y-3">
          {checklists.map((cl) => (
            <ChecklistCard
              key={cl.id}
              checklist={cl}
              onSave={(items) => saveItems(cl, items)}
              onDelete={() => deleteChecklist(cl.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistCard({
  checklist,
  onSave,
  onDelete,
}: {
  checklist: ChecklistData;
  onSave: (items: { text: string }[]) => void;
  onDelete: () => void;
}) {
  const [items, setItems] = useState(checklist.items.map((i) => i.text));
  const [dirty, setDirty] = useState(false);

  function updateItem(idx: number, text: string) {
    const next = [...items];
    next[idx] = text;
    setItems(next);
    setDirty(true);
  }

  function addItem() {
    setItems([...items, ""]);
    setDirty(true);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
    setDirty(true);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800">{checklist.title}</span>
        <button type="button" onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">Удалить</button>
      </div>

      <div className="space-y-1.5">
        {items.map((text, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              value={text}
              onChange={(e) => updateItem(i, e.target.value)}
              className={`flex-1 ${INPUT} !py-1.5 !text-xs`}
              placeholder={`Пункт ${i + 1}`}
            />
            <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-600 px-1">x</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <button type="button" onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-800">
          + Пункт
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => { onSave(items.filter(t => t.trim()).map(t => ({ text: t.trim() }))); setDirty(false); }}
            className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-700"
          >
            Сохранить
          </button>
        )}
      </div>
    </div>
  );
}

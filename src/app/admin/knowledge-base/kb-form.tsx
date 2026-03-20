"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { generateSlug } from "../courses/[id]/slug-utils";

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

interface KBFormData {
  id?: string;
  title: string;
  slug: string;
  type: string;
  description: string | null;
  content: string | null;
  category: string | null;
  tags: string[];
  minAccessTier: string;
  isPublished: boolean;
  filePath: string | null;
  videoPath: string | null;
}

const EMPTY: KBFormData = {
  title: "", slug: "", type: "DOCUMENT", description: null, content: null,
  category: null, tags: [], minAccessTier: "BASIC", isPublished: false,
  filePath: null, videoPath: null,
};

export function KBForm({ mode, initial }: { mode: "create" | "edit"; initial?: KBFormData }) {
  const router = useRouter();
  const [form, setForm] = useState<KBFormData>(initial ?? EMPTY);
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof KBFormData>(key: K, value: KBFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      type: form.type,
      description: form.description?.trim() || undefined,
      content: form.content?.trim() || undefined,
      category: form.category?.trim() || undefined,
      tags,
      minAccessTier: form.minAccessTier,
      filePath: form.filePath?.trim() || undefined,
      videoPath: form.videoPath?.trim() || undefined,
    };

    const url = mode === "create" ? "/api/admin/knowledge-base" : `/api/admin/knowledge-base/${form.id}`;
    const result = await apiClient(url, {
      method: mode === "create" ? "POST" : "PUT",
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }

    if (mode === "create") {
      const data = result.data as { item: { id: string } };
      router.push(`/admin/knowledge-base/${data.item.id}`);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    }
  }

  async function handlePublishToggle() {
    if (!form.id) return;
    setLoading(true);
    setError(null);

    const result = await apiClient(`/api/admin/knowledge-base/${form.id}/publish`, {
      method: "POST",
      body: JSON.stringify({ isPublished: !form.isPublished }),
    });

    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }
    set("isPublished", !form.isPublished);
    router.refresh();
  }

  async function handleDelete() {
    if (!form.id || !window.confirm("Удалить материал?")) return;
    setLoading(true);
    const result = await apiClient(`/api/admin/knowledge-base/${form.id}`, { method: "DELETE" });
    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }
    router.push("/admin/knowledge-base");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
      {mode === "edit" && (
        <div className="flex gap-2 mb-5">
          <button type="button" onClick={handlePublishToggle} disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${form.isPublished ? "border border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-green-600 text-white hover:bg-green-700"}`}>
            {form.isPublished ? "Снять с публикации" : "Опубликовать"}
          </button>
          <button type="button" onClick={handleDelete} disabled={loading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            Удалить
          </button>
        </div>
      )}

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Сохранено</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input type="text" value={form.title} onChange={(e) => { set("title", e.target.value); if (mode === "create") set("slug", generateSlug(e.target.value)); }} className={INPUT} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
            <input type="text" value={form.slug} onChange={(e) => set("slug", e.target.value)} className={INPUT} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className={INPUT}>
              <option value="DOCUMENT">Документ</option>
              <option value="TEMPLATE">Шаблон</option>
              <option value="WEBINAR_RECORDING">Запись вебинара</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Мин. уровень</label>
            <select value={form.minAccessTier} onChange={(e) => set("minAccessTier", e.target.value)} className={INPUT}>
              <option value="BASIC">Basic</option>
              <option value="STANDARD">Standard</option>
              <option value="PARTNER">Partner</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <input type="text" value={form.category ?? ""} onChange={(e) => set("category", e.target.value || null)} className={INPUT} placeholder="Банкротство" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Теги (через запятую)</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={INPUT} placeholder="шаблон, договор, банкротство" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} rows={3} className={INPUT} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Контент</label>
          <textarea value={form.content ?? ""} onChange={(e) => set("content", e.target.value || null)} rows={8} className={INPUT} placeholder="Текстовое содержимое..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Путь к файлу</label>
            <input type="text" value={form.filePath ?? ""} onChange={(e) => set("filePath", e.target.value || null)} className={INPUT} placeholder="/uploads/docs/file.pdf" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Путь к видео</label>
            <input type="text" value={form.videoPath ?? ""} onChange={(e) => set("videoPath", e.target.value || null)} className={INPUT} placeholder="https://..." />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Сохранение..." : mode === "create" ? "Создать материал" : "Сохранить"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

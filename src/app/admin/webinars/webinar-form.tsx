"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { generateSlug } from "../courses/[id]/slug-utils";

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

interface CourseOption { id: string; title: string; }

interface WebinarFormData {
  id?: string;
  title: string;
  slug: string;
  description: string;
  scheduledAt: string;
  streamUrl: string;
  recordingPath: string;
  isPublic: boolean;
  courseId: string;
  coverPath: string;
  status: string;
}

const EMPTY: WebinarFormData = {
  title: "", slug: "", description: "", scheduledAt: "", streamUrl: "",
  recordingPath: "", isPublic: false, courseId: "", coverPath: "", status: "SCHEDULED",
};

export function WebinarForm({
  mode,
  initial,
  courses,
}: {
  mode: "create" | "edit";
  initial?: WebinarFormData;
  courses: CourseOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial ?? EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof WebinarFormData>(key: K, value: WebinarFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      streamUrl: form.streamUrl.trim() || undefined,
      recordingPath: form.recordingPath.trim() || undefined,
      isPublic: form.isPublic,
      courseId: form.courseId || null,
      coverPath: form.coverPath.trim() || undefined,
    };

    const url = mode === "create" ? "/api/admin/webinars" : `/api/admin/webinars/${form.id}`;
    const result = await apiClient(url, {
      method: mode === "create" ? "POST" : "PUT",
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }

    if (mode === "create") {
      const data = result.data as { webinar: { id: string } };
      router.push(`/admin/webinars/${data.webinar.id}`);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    }
  }

  async function handleStatusChange(status: string) {
    if (!form.id) return;
    setLoading(true);
    setError(null);
    const result = await apiClient(`/api/admin/webinars/${form.id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }
    set("status", status);
    router.refresh();
  }

  async function handleDelete() {
    if (!form.id || !window.confirm("Удалить вебинар?")) return;
    setLoading(true);
    const result = await apiClient(`/api/admin/webinars/${form.id}`, { method: "DELETE" });
    setLoading(false);
    if (!result.ok) { setError(result.error.message); return; }
    router.push("/admin/webinars");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
      {mode === "edit" && (
        <div className="flex flex-wrap gap-2 mb-5">
          {form.status === "SCHEDULED" && (
            <button type="button" onClick={() => handleStatusChange("LIVE")} disabled={loading}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              Начать эфир
            </button>
          )}
          {form.status === "LIVE" && (
            <button type="button" onClick={() => handleStatusChange("ENDED")} disabled={loading}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
              Завершить эфир
            </button>
          )}
          {form.status !== "CANCELLED" && form.status !== "ENDED" && (
            <button type="button" onClick={() => handleStatusChange("CANCELLED")} disabled={loading}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              Отменить
            </button>
          )}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата и время *</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className={INPUT} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Курс (опц.)</label>
            <select value={form.courseId} onChange={(e) => set("courseId", e.target.value)} className={INPUT}>
              <option value="">Без курса</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={INPUT} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка на трансляцию</label>
          <input type="text" value={form.streamUrl} onChange={(e) => set("streamUrl", e.target.value)} className={INPUT} placeholder="https://youtube.com/live/... или embed URL" />
        </div>

        {mode === "edit" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка на запись</label>
            <input type="text" value={form.recordingPath} onChange={(e) => set("recordingPath", e.target.value)} className={INPUT} placeholder="https://..." />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="rounded border-gray-300" />
          Публичный вебинар (доступен всем)
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Сохранение..." : mode === "create" ? "Создать вебинар" : "Сохранить"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

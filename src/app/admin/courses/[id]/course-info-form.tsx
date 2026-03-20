"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { CourseData } from "./course-builder";
import { generateSlug } from "./slug-utils";

const INPUT =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function CourseInfoForm({
  course,
  onSave,
}: {
  course: CourseData;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [description, setDescription] = useState(course.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await apiClient(`/api/admin/courses/${course.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
      }),
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    onSave();
  }

  async function handlePublishToggle() {
    setLoading(true);
    setError(null);

    const result = await apiClient(`/api/admin/courses/${course.id}/publish`, {
      method: "POST",
      body: JSON.stringify({ isPublished: !course.isPublished }),
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSave();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Настройки курса</h2>
        <button
          type="button"
          onClick={handlePublishToggle}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            course.isPublished
              ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {course.isPublished ? "Снять с публикации" : "Опубликовать"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Сохранено
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (slug === generateSlug(title)) {
                setSlug(generateSlug(e.target.value));
              }
            }}
            className={INPUT}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={INPUT}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={INPUT}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}

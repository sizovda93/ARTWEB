"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

const INPUT =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

interface LessonDetail {
  id: string;
  moduleId: string;
  title: string;
  type: "VIDEO" | "TEXT" | "MIXED";
  content: string | null;
  videoPath: string | null;
  coverPath: string | null;
  videoDuration: number | null;
  isFree: boolean;
  requiresAssignment: boolean;
}

export function LessonEditor({
  courseId,
  lessonId,
  onSave,
  onDelete,
}: {
  courseId: string;
  lessonId: string;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"VIDEO" | "TEXT" | "MIXED">("MIXED");
  const [content, setContent] = useState("");
  const [videoPath, setVideoPath] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(false);
  // requiresAssignment: preparatory field, hidden until assignment flow is built
  const [requiresAssignment] = useState(false);

  const fetchLesson = useCallback(async () => {
    setLoadingData(true);
    const result = await apiClient<{ lesson: LessonDetail }>(
      `/api/admin/courses/${courseId}/lessons/${lessonId}`,
    );
    if (result.ok) {
      const l = result.data.lesson;
      setLesson(l);
      setTitle(l.title);
      setType(l.type);
      setContent(l.content ?? "");
      setVideoPath(l.videoPath ?? "");
      setCoverPath(l.coverPath);
      setIsFree(l.isFree);
    }
    setLoadingData(false);
  }, [courseId, lessonId]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "lessons");

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Ошибка загрузки");
      return;
    }

    setCoverPath(data.filePath);
    await apiClient(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
      method: "PUT",
      body: JSON.stringify({ coverPath: data.filePath }),
    });
    onSave();
  }

  async function handleRemoveCover() {
    setCoverPath(null);
    await apiClient(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
      method: "PUT",
      body: JSON.stringify({ coverPath: null }),
    });
    onSave();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await apiClient(
      `/api/admin/courses/${courseId}/lessons/${lessonId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          type,
          content: content.trim() || null,
          videoPath: videoPath.trim() || null,
          isFree,
          requiresAssignment,
        }),
      },
    );

    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    onSave();
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить урок "${title}"?`)) return;
    setSaving(true);

    const result = await apiClient(
      `/api/admin/courses/${courseId}/lessons/${lessonId}`,
      { method: "DELETE" },
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onDelete();
  }

  if (loadingData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-red-500">Урок не найден</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Урок</h2>

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

      {/* Cover image */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Обложка урока</label>
        {coverPath ? (
          <div className="relative inline-block">
            <img
              src={coverPath}
              alt="Обложка урока"
              className="h-32 w-auto rounded-lg border border-gray-200 object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveCover}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600"
              title="Удалить обложку"
            >
              x
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex h-32 w-52 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500"
          >
            {uploading ? "Загрузка..." : "Загрузить обложку"}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleCoverUpload}
          className="hidden"
        />
        {coverPath && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-2 block text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {uploading ? "Загрузка..." : "Заменить"}
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className={INPUT}
            >
              <option value="MIXED">Смешанный</option>
              <option value="VIDEO">Видео</option>
              <option value="TEXT">Текст</option>
            </select>
          </div>
        </div>

        {(type === "VIDEO" || type === "MIXED") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Путь к видео</label>
            <input
              type="text"
              value={videoPath}
              onChange={(e) => setVideoPath(e.target.value)}
              className={INPUT}
              placeholder="/videos/lesson-01.mp4 или URL"
            />
          </div>
        )}

        {(type === "TEXT" || type === "MIXED") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Контент</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className={INPUT}
              placeholder="Текстовое содержимое урока..."
            />
          </div>
        )}

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="rounded border-gray-300"
            />
            Бесплатный урок
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded-lg border border-red-300 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Удалить урок
          </button>
        </div>
      </form>
    </div>
  );
}

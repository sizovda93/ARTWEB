"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { BuilderSidebar } from "./builder-sidebar";
import { CourseInfoForm } from "./course-info-form";
import { LessonEditor } from "./lesson-editor";
import { ModuleEditor } from "./module-editor";

interface LessonSummary {
  id: string;
  title: string;
  type: string;
  isFree: boolean;
  sortOrder: number;
  videoPath: string | null;
  requiresAssignment: boolean;
}

interface ModuleData {
  id: string;
  title: string;
  sortOrder: number;
  lessons: LessonSummary[];
}

export interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverPath: string | null;
  isPublished: boolean;
  sortOrder: number;
  modules: ModuleData[];
}

type Selection =
  | { type: "course" }
  | { type: "module"; id: string }
  | { type: "lesson"; id: string; moduleId: string };

export function CourseBuilder({ initial }: { initial: CourseData }) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseData>(initial);
  const [selection, setSelection] = useState<Selection>({ type: "course" });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await apiClient<{ course: CourseData }>(`/api/admin/courses/${course.id}`);
    if (result.ok) {
      setCourse(result.data.course);
    }
    setRefreshing(false);
    router.refresh();
  }, [course.id, router]);

  const selectedModule =
    selection.type === "module"
      ? course.modules.find((m) => m.id === selection.id)
      : null;

  const selectedLesson =
    selection.type === "lesson"
      ? course.modules
          .flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })))
          .find((l) => l.id === selection.id)
      : null;

  return (
    <div className={`flex gap-6 min-h-[600px] ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Sidebar */}
      <div className="w-80 shrink-0">
        <BuilderSidebar
          courseId={course.id}
          modules={course.modules}
          selection={selection}
          onSelect={setSelection}
          onMutate={refresh}
        />
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0">
        {selection.type === "course" && (
          <CourseInfoForm course={course} onSave={refresh} />
        )}

        {selection.type === "module" && selectedModule && (
          <ModuleEditor
            courseId={course.id}
            module={selectedModule}
            onSave={refresh}
            onDelete={() => {
              setSelection({ type: "course" });
              refresh();
            }}
          />
        )}

        {selection.type === "lesson" && selectedLesson && (
          <LessonEditor
            courseId={course.id}
            lessonId={selectedLesson.id}
            onSave={refresh}
            onDelete={() => {
              setSelection({ type: "course" });
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

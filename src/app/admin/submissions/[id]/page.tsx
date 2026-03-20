import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { ReviewForm } from "./review-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Проверка ответа — ARTWEB Admin" };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  PENDING: { label: "Ожидает проверки", variant: "warning" },
  AI_REVIEWED: { label: "AI проверено", variant: "info" },
  APPROVED: { label: "Принято", variant: "success" },
  REJECTED: { label: "Отклонено", variant: "error" },
  REVISION_REQUESTED: { label: "На доработку", variant: "warning" },
};

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminFresh(); } catch (e) {
    if (e instanceof AuthError) redirect(e.code === "NOT_AUTHENTICATED" ? "/login" : "/");
    throw e;
  }

  const { id } = await params;

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      files: { orderBy: { createdAt: "asc" } },
      assignment: {
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: { options: { orderBy: { sortOrder: "asc" } } },
          },
          lesson: {
            select: {
              title: true,
              module: { select: { title: true, course: { select: { title: true } } } },
            },
          },
        },
      },
    },
  });

  if (!submission) notFound();

  const sc = STATUS_CONFIG[submission.status] ?? { label: submission.status, variant: "neutral" as const };
  const testAnswers = (submission.testAnswers as Record<string, string[]> | null) ?? {};

  return (
    <>
      <PageHeader
        title="Проверка ответа"
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={sc.variant}>{sc.label}</Badge>
            <Link href="/admin/submissions" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              &larr; К списку
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student info */}
          <SectionCard title="Студент">
            <p className="text-sm font-medium text-gray-900">{submission.user.firstName} {submission.user.lastName}</p>
            <p className="text-sm text-gray-500">{submission.user.email}</p>
          </SectionCard>

          {/* Context */}
          <SectionCard title="Контекст">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Курс</dt><dd className="font-medium text-gray-900">{submission.assignment.lesson.module.course.title}</dd></div>
              <div><dt className="text-gray-500">Урок</dt><dd className="font-medium text-gray-900">{submission.assignment.lesson.title}</dd></div>
              <div><dt className="text-gray-500">Задание</dt><dd className="font-medium text-gray-900">{submission.assignment.title}</dd></div>
              <div><dt className="text-gray-500">Тип</dt><dd className="font-medium text-gray-900">{submission.assignment.type}</dd></div>
              <div><dt className="text-gray-500">Отправлено</dt><dd className="text-gray-700">{new Date(submission.createdAt).toLocaleString("ru-RU")}</dd></div>
              {submission.reviewedAt && (
                <div><dt className="text-gray-500">Проверено</dt><dd className="text-gray-700">{new Date(submission.reviewedAt).toLocaleString("ru-RU")}</dd></div>
              )}
            </dl>
          </SectionCard>

          {/* Text answer */}
          {submission.assignment.type === "TEXT" && submission.textAnswer && (
            <SectionCard title="Ответ студента">
              <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-lg p-4">
                {submission.textAnswer}
              </div>
            </SectionCard>
          )}

          {/* Test results */}
          {submission.assignment.type === "TEST" && (
            <SectionCard title="Ответы на тест">
              <div className="space-y-4">
                {submission.assignment.questions.map((q, qi) => {
                  const userAnswers = testAnswers[q.id] ?? [];
                  return (
                    <div key={q.id} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-800 mb-2">{qi + 1}. {q.text}</p>
                      <div className="space-y-1">
                        {q.options.map((opt) => {
                          const selected = userAnswers.includes(opt.id);
                          const isCorrect = opt.isCorrect;
                          let bg = "";
                          if (selected && isCorrect) bg = "bg-green-100 text-green-800";
                          else if (selected && !isCorrect) bg = "bg-red-100 text-red-800";
                          else if (!selected && isCorrect) bg = "bg-green-50 text-green-600";

                          return (
                            <div key={opt.id} className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${bg}`}>
                              <span>{selected ? "●" : "○"}</span>
                              <span>{opt.text}</span>
                              {isCorrect && <span className="text-xs text-green-600 ml-auto">верно</span>}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <p className="mt-1.5 text-xs text-gray-500">Пояснение: {q.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Files */}
          {submission.files.length > 0 && (
            <SectionCard title="Файлы">
              <div className="space-y-2">
                {submission.files.map((f) => (
                  <a key={f.id} href={f.filePath} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{f.fileName}</span>
                    {f.fileSize && <span className="text-xs text-gray-400">{Math.round(f.fileSize / 1024)} КБ</span>}
                  </a>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right: review form */}
        <div>
          <ReviewForm
            submissionId={submission.id}
            currentStatus={submission.status}
            currentScore={submission.finalScore}
            currentComment={submission.finalComment}
            maxScore={submission.assignment.maxScore}
          />
        </div>
      </div>
    </>
  );
}

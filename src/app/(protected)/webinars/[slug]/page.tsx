import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCourseAccess } from "@/lib/access";
import { Badge } from "@/components/ui/badge";
import { WebinarPlayer } from "./webinar-player";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Вебинар — ARTWEB" };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  SCHEDULED: { label: "Запланирован", variant: "info" },
  LIVE: { label: "В эфире", variant: "success" },
  ENDED: { label: "Завершён", variant: "neutral" },
  CANCELLED: { label: "Отменён", variant: "error" },
};

export default async function StudentWebinarPage({ params }: { params: Promise<{ slug: string }> }) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { slug } = await params;

  const webinar = await prisma.webinar.findUnique({
    where: { slug },
    include: {
      course: { select: { id: true, title: true } },
      materials: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!webinar || webinar.status === "CANCELLED") notFound();

  // Access check
  let hasAccess = false;
  if (webinar.isPublic) {
    hasAccess = true;
  } else if (webinar.courseId) {
    hasAccess = await checkCourseAccess(auth.userId, webinar.courseId);
  }

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-700 font-medium mb-2">Доступ закрыт</p>
          <p className="text-sm text-amber-600 mb-4">Для просмотра этого вебинара необходим доступ к курсу.</p>
          <Link href="/webinars" className="inline-flex items-center rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-100">
            &larr; К вебинарам
          </Link>
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[webinar.status] ?? { label: webinar.status, variant: "neutral" as const };
  const showStream = webinar.status === "LIVE" && webinar.streamUrl;
  const showRecording = webinar.status === "ENDED" && webinar.recordingPath;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/webinars" className="hover:text-gray-600">Вебинары</Link>
        <span>/</span>
        <span className="text-gray-600">{webinar.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{webinar.title}</h1>
          <Badge variant={sc.variant}>{sc.label}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            {new Date(webinar.scheduledAt).toLocaleString("ru-RU", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
          {webinar.course && <span>· {webinar.course.title}</span>}
        </div>
        {webinar.description && <p className="mt-3 text-gray-600">{webinar.description}</p>}
      </div>

      {/* Cover */}
      {webinar.coverPath && !showStream && !showRecording && (
        <img src={webinar.coverPath} alt={webinar.title} className="w-full max-h-72 object-cover rounded-xl mb-6" />
      )}

      {/* Stream / Recording player */}
      {(showStream || showRecording) && (
        <div className="mb-6">
          <WebinarPlayer
            webinarId={webinar.id}
            url={(showStream ? webinar.streamUrl : webinar.recordingPath)!}
            isLive={webinar.status === "LIVE"}
          />
        </div>
      )}

      {/* Scheduled — countdown/waiting */}
      {webinar.status === "SCHEDULED" && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center mb-6">
          <p className="text-indigo-700 font-medium mb-1">Вебинар ещё не начался</p>
          <p className="text-sm text-indigo-600">
            Начало: {new Date(webinar.scheduledAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}

      {/* Materials */}
      {webinar.materials.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Материалы</h2>
          <div className="space-y-2">
            {webinar.materials.map((m) => (
              <a key={m.id} href={m.filePath} target="_blank" rel="noopener noreferrer"
                className="flex items-center rounded-lg border border-gray-100 px-4 py-2.5 hover:bg-gray-50 text-sm font-medium text-gray-700">
                {m.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <Link href="/webinars" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        &larr; Все вебинары
      </Link>
    </div>
  );
}

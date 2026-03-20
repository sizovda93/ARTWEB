import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createChecklistSchema } from "@/lib/validations/assignment";

type RouteCtx = { params: Promise<{ id: string; lessonId: string }> };

async function verifyLesson(courseId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    throw new AuthError("VALIDATION_ERROR", "Урок не найден");
  }
}

/** GET — list checklists for lesson */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id: courseId, lessonId } = await params;
    await verifyLesson(courseId, lessonId);

    const checklists = await prisma.checklist.findMany({
      where: { lessonId },
      orderBy: { sortOrder: "asc" },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ checklists });
  } catch (error) {
    return handleApiError(error, "AdminChecklistList");
  }
}

/** POST — create checklist with items */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id: courseId, lessonId } = await params;
    const body = await request.json();
    const input = createChecklistSchema.parse(body);
    const ip = getClientIp(request);

    await verifyLesson(courseId, lessonId);

    const maxSort = await prisma.checklist.aggregate({
      where: { lessonId },
      _max: { sortOrder: true },
    });

    const checklist = await prisma.$transaction(async (tx) => {
      const created = await tx.checklist.create({
        data: {
          lessonId,
          title: input.title,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          items: {
            create: input.items.map((text, i) => ({ text, sortOrder: i })),
          },
        },
        include: { items: true },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "checklist_created",
          targetType: "Checklist",
          targetId: created.id,
          newData: { lessonId, title: input.title, itemsCount: input.items.length },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ checklist }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminChecklistCreate");
  }
}

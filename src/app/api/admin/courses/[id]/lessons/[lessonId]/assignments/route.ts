import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createAssignmentSchema } from "@/lib/validations/assignment";

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

/** GET — list assignments for lesson */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id: courseId, lessonId } = await params;
    await verifyLesson(courseId, lessonId);

    const assignments = await prisma.assignment.findMany({
      where: { lessonId },
      orderBy: { sortOrder: "asc" },
      include: {
        questions: {
          orderBy: { sortOrder: "asc" },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        },
        _count: { select: { submissions: true } },
      },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    return handleApiError(error, "AdminAssignmentList");
  }
}

/** POST — create assignment */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id: courseId, lessonId } = await params;
    const body = await request.json();
    const input = createAssignmentSchema.parse(body);
    const ip = getClientIp(request);

    await verifyLesson(courseId, lessonId);

    const maxSort = await prisma.assignment.aggregate({
      where: { lessonId },
      _max: { sortOrder: true },
    });

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          lessonId,
          title: input.title,
          description: input.description,
          type: input.type,
          maxScore: input.maxScore,
          isRequired: input.isRequired,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "assignment_created",
          targetType: "Assignment",
          targetId: created.id,
          newData: { lessonId, title: input.title, type: input.type },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ assignment: { id: assignment.id } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminAssignmentCreate");
  }
}

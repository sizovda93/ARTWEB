import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateAssignmentSchema } from "@/lib/validations/assignment";

type RouteCtx = { params: Promise<{ id: string; lessonId: string; assignmentId: string }> };

/** PUT — update assignment */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { assignmentId } = await params;
    const body = await request.json();
    const input = updateAssignmentSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Задание не найдено");

    await prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          title: input.title,
          description: input.description,
          maxScore: input.maxScore,
          isRequired: input.isRequired,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "assignment_updated",
          targetType: "Assignment",
          targetId: assignmentId,
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminAssignmentUpdate");
  }
}

/** DELETE — delete assignment */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { assignmentId } = await params;
    const ip = getClientIp(request);

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { title: true, lessonId: true, _count: { select: { submissions: true } } },
    });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Задание не найдено");

    await prisma.$transaction(async (tx) => {
      await tx.assignment.delete({ where: { id: assignmentId } });
      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "assignment_deleted",
          targetType: "Assignment",
          targetId: assignmentId,
          previousData: { title: existing.title, lessonId: existing.lessonId },
          details: { cascadeDeletedSubmissions: existing._count.submissions },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminAssignmentDelete");
  }
}

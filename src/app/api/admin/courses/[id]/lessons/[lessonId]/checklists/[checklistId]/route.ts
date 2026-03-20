import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateChecklistSchema } from "@/lib/validations/assignment";

type RouteCtx = { params: Promise<{ id: string; lessonId: string; checklistId: string }> };

/** PUT — update checklist title and/or items */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { checklistId } = await params;
    const body = await request.json();
    const input = updateChecklistSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Чеклист не найден");

    await prisma.$transaction(async (tx) => {
      if (input.title) {
        await tx.checklist.update({ where: { id: checklistId }, data: { title: input.title } });
      }

      if (input.items) {
        await tx.checklistItem.deleteMany({ where: { checklistId } });
        await tx.checklistItem.createMany({
          data: input.items.map((item, i) => ({
            checklistId,
            text: item.text,
            sortOrder: i,
          })),
        });
      }

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "checklist_updated",
          targetType: "Checklist",
          targetId: checklistId,
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminChecklistUpdate");
  }
}

/** DELETE — delete checklist */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { checklistId } = await params;
    const ip = getClientIp(request);

    const existing = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { title: true, lessonId: true } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Чеклист не найден");

    await prisma.$transaction(async (tx) => {
      await tx.checklist.delete({ where: { id: checklistId } });
      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "checklist_deleted",
          targetType: "Checklist",
          targetId: checklistId,
          previousData: { title: existing.title, lessonId: existing.lessonId },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminChecklistDelete");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { changeStatusSchema } from "@/lib/validations/webinar";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/webinars/[id]/status — change webinar status */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const body = await request.json();
    const { status } = changeStatusSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.webinar.findUnique({ where: { id }, select: { status: true, title: true } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Вебинар не найден");

    const data: Record<string, unknown> = { status };
    if (status === "LIVE" && existing.status !== "LIVE") data.startedAt = new Date();
    if (status === "ENDED" && existing.status !== "ENDED") data.endedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.webinar.update({ where: { id }, data });
      await writeAuditLog({
        actorId: auth.userId, actorRole: auth.role,
        action: "webinar_status_changed", targetType: "Webinar", targetId: id,
        previousData: { status: existing.status },
        newData: { status },
        ipAddress: ip,
      }, tx);
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return handleApiError(error, "AdminWebinarStatus");
  }
}

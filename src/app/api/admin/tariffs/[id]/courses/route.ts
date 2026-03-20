import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";

const linkSchema = z.object({
  courseId: z.string().uuid(),
});

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/tariffs/[id]/courses — link course */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: tariffId } = await params;
    const body = await request.json();
    const { courseId } = linkSchema.parse(body);
    const ip = getClientIp(request);

    // Verify tariff + course exist
    const [tariff, course] = await Promise.all([
      prisma.tariff.findUnique({ where: { id: tariffId }, select: { id: true, name: true } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    ]);
    if (!tariff) throw new AuthError("VALIDATION_ERROR", "Тариф не найден");
    if (!course) throw new AuthError("VALIDATION_ERROR", "Курс не найден");

    // Check if already linked
    const existing = await prisma.tariffCourse.findUnique({
      where: { tariffId_courseId: { tariffId, courseId } },
    });
    if (existing) {
      throw new AuthError("VALIDATION_ERROR", "Курс уже привязан к этому тарифу");
    }

    await prisma.$transaction(async (tx) => {
      await tx.tariffCourse.create({
        data: { tariffId, courseId },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "tariff_course_linked",
          targetType: "Tariff",
          targetId: tariffId,
          newData: { courseId, courseTitle: course.title },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminTariffLinkCourse");
  }
}

/** DELETE /api/admin/tariffs/[id]/courses — unlink course */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: tariffId } = await params;
    const body = await request.json();
    const { courseId } = linkSchema.parse(body);
    const ip = getClientIp(request);

    const link = await prisma.tariffCourse.findUnique({
      where: { tariffId_courseId: { tariffId, courseId } },
      include: { course: { select: { title: true } } },
    });
    if (!link) {
      throw new AuthError("VALIDATION_ERROR", "Связь не найдена");
    }

    await prisma.$transaction(async (tx) => {
      await tx.tariffCourse.delete({
        where: { tariffId_courseId: { tariffId, courseId } },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "tariff_course_unlinked",
          targetType: "Tariff",
          targetId: tariffId,
          previousData: { courseId, courseTitle: link.course.title },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminTariffUnlinkCourse");
  }
}

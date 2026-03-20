import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { publishToggleSchema } from "@/lib/validations/course";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/courses/[id]/publish — toggle publish */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id } = await params;
    const body = await request.json();
    const { isPublished } = publishToggleSchema.parse(body);
    const ip = getClientIp(request);

    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, isPublished: true, title: true },
    });
    if (!course) {
      throw new AuthError("VALIDATION_ERROR", "Курс не найден");
    }

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: { isPublished },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: isPublished ? "course_published" : "course_unpublished",
          targetType: "Course",
          targetId: id,
          previousData: { isPublished: course.isPublished },
          newData: { isPublished },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, isPublished });
  } catch (error) {
    return handleApiError(error, "AdminCoursePublish");
  }
}

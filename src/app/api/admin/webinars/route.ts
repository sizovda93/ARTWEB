import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createWebinarSchema } from "@/lib/validations/webinar";

/** GET /api/admin/webinars */
export async function GET() {
  try {
    await requireAdminFresh();
    const webinars = await prisma.webinar.findMany({
      orderBy: { scheduledAt: "desc" },
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { attendances: true } },
      },
    });
    return NextResponse.json({ webinars });
  } catch (error) {
    return handleApiError(error, "AdminWebinarList");
  }
}

/** POST /api/admin/webinars */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const body = await request.json();
    const input = createWebinarSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.webinar.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (existing) throw new AuthError("VALIDATION_ERROR", "Вебинар с таким slug уже существует");

    if (input.courseId) {
      const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { id: true } });
      if (!course) throw new AuthError("VALIDATION_ERROR", "Курс не найден");
    }

    const webinar = await prisma.$transaction(async (tx) => {
      const created = await tx.webinar.create({
        data: {
          title: input.title,
          slug: input.slug,
          description: input.description,
          scheduledAt: new Date(input.scheduledAt),
          streamUrl: input.streamUrl,
          isPublic: input.isPublic,
          courseId: input.courseId ?? null,
          coverPath: input.coverPath,
          maxAttendees: input.maxAttendees ?? null,
        },
      });

      await writeAuditLog({
        actorId: auth.userId, actorRole: auth.role,
        action: "webinar_created", targetType: "Webinar", targetId: created.id,
        newData: { title: input.title, slug: input.slug, scheduledAt: input.scheduledAt },
        ipAddress: ip,
      }, tx);

      return created;
    });

    return NextResponse.json({ webinar: { id: webinar.id, slug: webinar.slug } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminWebinarCreate");
  }
}

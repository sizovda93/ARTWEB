import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateWebinarSchema } from "@/lib/validations/webinar";
import type { Prisma } from "@/generated/prisma/client";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/webinars/[id] */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id } = await params;
    const webinar = await prisma.webinar.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
        materials: { orderBy: { sortOrder: "asc" } },
        _count: { select: { attendances: true } },
      },
    });
    if (!webinar) throw new AuthError("VALIDATION_ERROR", "Вебинар не найден");
    return NextResponse.json({ webinar });
  } catch (error) {
    return handleApiError(error, "AdminWebinarDetail");
  }
}

/** PUT /api/admin/webinars/[id] */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const body = await request.json();
    const input = updateWebinarSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.webinar.findUnique({ where: { id } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Вебинар не найден");

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await prisma.webinar.findUnique({ where: { slug: input.slug }, select: { id: true } });
      if (slugTaken) throw new AuthError("VALIDATION_ERROR", "Вебинар с таким slug уже существует");
    }

    const prevSnap: Record<string, unknown> = {};
    const newSnap: Record<string, unknown> = {};
    const keys = ["title", "slug", "description", "streamUrl", "recordingPath", "isPublic", "coverPath", "maxAttendees", "courseId"] as const;
    for (const key of keys) {
      if (input[key] !== undefined && input[key] !== existing[key]) {
        prevSnap[key] = existing[key];
        newSnap[key] = input[key];
      }
    }
    if (input.scheduledAt && new Date(input.scheduledAt).toISOString() !== existing.scheduledAt.toISOString()) {
      prevSnap.scheduledAt = existing.scheduledAt.toISOString();
      newSnap.scheduledAt = input.scheduledAt;
    }

    await prisma.$transaction(async (tx) => {
      await tx.webinar.update({
        where: { id },
        data: {
          title: input.title,
          slug: input.slug,
          description: input.description,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          streamUrl: input.streamUrl,
          recordingPath: input.recordingPath,
          isPublic: input.isPublic,
          courseId: input.courseId,
          coverPath: input.coverPath,
          maxAttendees: input.maxAttendees,
        },
      });

      if (Object.keys(newSnap).length > 0) {
        await writeAuditLog({
          actorId: auth.userId, actorRole: auth.role,
          action: "webinar_updated", targetType: "Webinar", targetId: id,
          previousData: prevSnap as Prisma.InputJsonValue,
          newData: newSnap as Prisma.InputJsonValue,
          ipAddress: ip,
        }, tx);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminWebinarUpdate");
  }
}

/** DELETE /api/admin/webinars/[id] */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const ip = getClientIp(request);
    const existing = await prisma.webinar.findUnique({ where: { id }, select: { title: true } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Вебинар не найден");

    await prisma.$transaction(async (tx) => {
      await tx.webinar.delete({ where: { id } });
      await writeAuditLog({
        actorId: auth.userId, actorRole: auth.role,
        action: "webinar_deleted", targetType: "Webinar", targetId: id,
        previousData: { title: existing.title },
        ipAddress: ip,
      }, tx);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminWebinarDelete");
  }
}

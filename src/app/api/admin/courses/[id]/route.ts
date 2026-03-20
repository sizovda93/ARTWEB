import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateCourseSchema } from "@/lib/validations/course";
import type { Prisma } from "@/generated/prisma/client";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/courses/[id] — full course with modules/lessons tree */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id } = await params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                title: true,
                type: true,
                isFree: true,
                sortOrder: true,
                videoPath: true,
                requiresAssignment: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new AuthError("VALIDATION_ERROR", "Курс не найден");
    }

    return NextResponse.json({ course });
  } catch (error) {
    return handleApiError(error, "AdminCourseDetail");
  }
}

/** PUT /api/admin/courses/[id] — update course metadata */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id } = await params;
    const body = await request.json();
    const input = updateCourseSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw new AuthError("VALIDATION_ERROR", "Курс не найден");
    }

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await prisma.course.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });
      if (slugTaken) {
        throw new AuthError("VALIDATION_ERROR", "Курс с таким slug уже существует");
      }
    }

    const prevSnap: Record<string, unknown> = {};
    const newSnap: Record<string, unknown> = {};
    const keys = ["title", "slug", "description", "coverPath", "sortOrder"] as const;
    for (const key of keys) {
      if (input[key] !== undefined && input[key] !== existing[key]) {
        prevSnap[key] = existing[key];
        newSnap[key] = input[key];
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: {
          title: input.title,
          slug: input.slug,
          description: input.description,
          coverPath: input.coverPath,
          sortOrder: input.sortOrder,
        },
      });

      if (Object.keys(newSnap).length > 0) {
        await writeAuditLog(
          {
            actorId: auth.userId,
            actorRole: auth.role,
            action: "course_updated",
            targetType: "Course",
            targetId: id,
            previousData: prevSnap as Prisma.InputJsonValue,
            newData: newSnap as Prisma.InputJsonValue,
            ipAddress: ip,
          },
          tx,
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminCourseUpdate");
  }
}

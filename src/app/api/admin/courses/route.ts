import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createCourseSchema } from "@/lib/validations/course";

const PAGE_SIZE = 20;

/** GET /api/admin/courses — list courses */
export async function GET(request: NextRequest) {
  try {
    await requireAdminFresh();

    const url = request.nextUrl;
    const search = url.searchParams.get("search") ?? "";
    const status = url.searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status === "published") where.isPublished = true;
    if (status === "draft") where.isPublished = false;

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          _count: { select: { modules: true } },
          modules: {
            select: { _count: { select: { lessons: true } } },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    const items = courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      isPublished: c.isPublished,
      sortOrder: c.sortOrder,
      modulesCount: c._count.modules,
      lessonsCount: c.modules.reduce((sum, m) => sum + m._count.lessons, 0),
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({
      courses: items,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (error) {
    return handleApiError(error, "AdminCoursesList");
  }
}

/** POST /api/admin/courses — create course */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const body = await request.json();
    const input = createCourseSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.course.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw new AuthError("VALIDATION_ERROR", "Курс с таким slug уже существует");
    }

    const maxSort = await prisma.course.aggregate({ _max: { sortOrder: true } });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          title: input.title,
          slug: input.slug,
          description: input.description,
          sortOrder: nextSort,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "course_created",
          targetType: "Course",
          targetId: created.id,
          newData: { title: input.title, slug: input.slug },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ course: { id: course.id, slug: course.slug } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminCourseCreate");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { handleApiError } from "@/lib/api-response";
import { reorderSchema } from "@/lib/validations/course";

type RouteCtx = { params: Promise<{ id: string }> };

/** PUT /api/admin/courses/[id]/modules/reorder — reorder modules */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id: courseId } = await params;
    const body = await request.json();
    const { orderedIds } = reorderSchema.parse(body);

    const modules = await prisma.module.findMany({
      where: { courseId },
      select: { id: true },
    });
    const existingIds = new Set(modules.map((m) => m.id));
    for (const mid of orderedIds) {
      if (!existingIds.has(mid)) {
        throw new AuthError("VALIDATION_ERROR", "Модуль не принадлежит этому курсу");
      }
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.module.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminModuleReorder");
  }
}

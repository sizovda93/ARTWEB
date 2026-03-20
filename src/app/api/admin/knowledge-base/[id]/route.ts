import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { updateKnowledgeItemSchema } from "@/lib/validations/knowledge";
import type { Prisma } from "@/generated/prisma/client";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/knowledge-base/[id] — detail */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id } = await params;

    const item = await prisma.knowledgeItem.findUnique({
      where: { id },
      include: { attachments: { orderBy: { sortOrder: "asc" } } },
    });
    if (!item) throw new AuthError("VALIDATION_ERROR", "Материал не найден");

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error, "AdminKBDetail");
  }
}

/** PUT /api/admin/knowledge-base/[id] — update */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const body = await request.json();
    const input = updateKnowledgeItemSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.knowledgeItem.findUnique({ where: { id } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Материал не найден");

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await prisma.knowledgeItem.findUnique({ where: { slug: input.slug }, select: { id: true } });
      if (slugTaken) throw new AuthError("VALIDATION_ERROR", "Материал с таким slug уже существует");
    }

    const prevSnap: Record<string, unknown> = {};
    const newSnap: Record<string, unknown> = {};
    const keys = ["title", "slug", "type", "description", "content", "category", "minAccessTier", "filePath", "videoPath"] as const;
    for (const key of keys) {
      if (input[key] !== undefined && input[key] !== existing[key]) {
        prevSnap[key] = existing[key];
        newSnap[key] = input[key];
      }
    }
    if (input.tags !== undefined && JSON.stringify(input.tags) !== JSON.stringify(existing.tags)) {
      prevSnap.tags = existing.tags;
      newSnap.tags = input.tags;
    }

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeItem.update({
        where: { id },
        data: {
          title: input.title,
          slug: input.slug,
          type: input.type,
          description: input.description,
          content: input.content,
          category: input.category,
          tags: input.tags,
          minAccessTier: input.minAccessTier,
          filePath: input.filePath,
          videoPath: input.videoPath,
        },
      });

      if (Object.keys(newSnap).length > 0) {
        await writeAuditLog(
          {
            actorId: auth.userId,
            actorRole: auth.role,
            action: "knowledge_item_updated",
            targetType: "KnowledgeItem",
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
    return handleApiError(error, "AdminKBUpdate");
  }
}

/** DELETE /api/admin/knowledge-base/[id] — delete */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const ip = getClientIp(request);

    const existing = await prisma.knowledgeItem.findUnique({ where: { id }, select: { title: true } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Материал не найден");

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeItem.delete({ where: { id } });
      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "knowledge_item_deleted",
          targetType: "KnowledgeItem",
          targetId: id,
          previousData: { title: existing.title },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminKBDelete");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { publishKnowledgeItemSchema } from "@/lib/validations/knowledge";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/knowledge-base/[id]/publish — toggle publish */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const body = await request.json();
    const { isPublished } = publishKnowledgeItemSchema.parse(body);
    const ip = getClientIp(request);

    const item = await prisma.knowledgeItem.findUnique({ where: { id }, select: { id: true, isPublished: true } });
    if (!item) throw new AuthError("VALIDATION_ERROR", "Материал не найден");

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeItem.update({ where: { id }, data: { isPublished } });
      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: isPublished ? "knowledge_item_published" : "knowledge_item_unpublished",
          targetType: "KnowledgeItem",
          targetId: id,
          previousData: { isPublished: item.isPublished },
          newData: { isPublished },
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, isPublished });
  } catch (error) {
    return handleApiError(error, "AdminKBPublish");
  }
}

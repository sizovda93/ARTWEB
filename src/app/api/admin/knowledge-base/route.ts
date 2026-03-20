import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { createKnowledgeItemSchema } from "@/lib/validations/knowledge";

/** GET /api/admin/knowledge-base — list all items */
export async function GET() {
  try {
    await requireAdminFresh();

    const items = await prisma.knowledgeItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { attachments: true } } },
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, "AdminKBList");
  }
}

/** POST /api/admin/knowledge-base — create item */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const body = await request.json();
    const input = createKnowledgeItemSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.knowledgeItem.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) throw new AuthError("VALIDATION_ERROR", "Материал с таким slug уже существует");

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.knowledgeItem.create({
        data: {
          title: input.title,
          slug: input.slug,
          type: input.type,
          description: input.description,
          content: input.content,
          category: input.category ?? null,
          tags: input.tags,
          minAccessTier: input.minAccessTier,
          filePath: input.filePath ?? null,
          videoPath: input.videoPath ?? null,
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "knowledge_item_created",
          targetType: "KnowledgeItem",
          targetId: created.id,
          newData: { title: input.title, slug: input.slug, type: input.type },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ item: { id: item.id, slug: item.slug } }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminKBCreate");
  }
}

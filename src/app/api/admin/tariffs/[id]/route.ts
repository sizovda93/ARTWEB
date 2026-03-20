import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import type { Prisma } from "@/generated/prisma/client";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug: только a-z, 0-9, дефис")
    .optional(),
  tier: z.enum(["BASIC", "STANDARD", "PARTNER"]).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().min(0).optional(),
  oldPrice: z.number().min(0).nullable().optional(),
  currency: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  features: z
    .array(
      z.object({
        feature: z.enum(["KNOWLEDGE_BASE_ACCESS", "AI_CHAT_ACCESS"]),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/tariffs/[id] — single tariff detail */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id } = await params;

    const tariff = await prisma.tariff.findUnique({
      where: { id },
      include: {
        tariffFeatures: true,
        tariffCourses: {
          include: {
            course: { select: { id: true, title: true, slug: true, isPublished: true } },
          },
        },
        _count: { select: { accessGrants: { where: { isActive: true } } } },
      },
    });

    if (!tariff) {
      throw new AuthError("VALIDATION_ERROR", "Тариф не найден");
    }

    return NextResponse.json({ tariff });
  } catch (error) {
    return handleApiError(error, "AdminTariffDetail");
  }
}

/** PUT /api/admin/tariffs/[id] — update tariff */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const { id } = await params;
    const body = await request.json();
    const input = updateSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.tariff.findUnique({
      where: { id },
      include: { tariffFeatures: true },
    });
    if (!existing) {
      throw new AuthError("VALIDATION_ERROR", "Тариф не найден");
    }

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await prisma.tariff.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });
      if (slugTaken) {
        throw new AuthError("VALIDATION_ERROR", "Тариф с таким slug уже существует");
      }
    }

    // Build previous/new snapshots for audit
    const prevSnap: Record<string, string | number | boolean | null> = {};
    const newSnap: Record<string, string | number | boolean | null> = {};

    const SCALAR_KEYS = ["name", "slug", "tier", "description", "currency", "isActive", "sortOrder"] as const;
    for (const key of SCALAR_KEYS) {
      if (input[key] !== undefined && input[key] !== existing[key]) {
        prevSnap[key] = existing[key] as string | number | boolean | null;
        newSnap[key] = input[key] as string | number | boolean | null;
      }
    }
    if (input.price !== undefined && input.price !== Number(existing.price)) {
      prevSnap.price = Number(existing.price);
      newSnap.price = input.price;
    }
    if (input.oldPrice !== undefined) {
      const existingOld = existing.oldPrice ? Number(existing.oldPrice) : null;
      if (input.oldPrice !== existingOld) {
        prevSnap.oldPrice = existingOld;
        newSnap.oldPrice = input.oldPrice;
      }
    }

    // Determine audit action
    let auditAction: "tariff_updated" | "tariff_activated" | "tariff_deactivated" = "tariff_updated";
    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      auditAction = input.isActive ? "tariff_activated" : "tariff_deactivated";
    }

    await prisma.$transaction(async (tx) => {
      await tx.tariff.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          tier: input.tier,
          description: input.description,
          price: input.price,
          oldPrice: input.oldPrice,
          currency: input.currency,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      });

      // Sync features if provided: delete all → recreate
      if (input.features !== undefined) {
        await tx.tariffFeature.deleteMany({ where: { tariffId: id } });
        if (input.features.length > 0) {
          await tx.tariffFeature.createMany({
            data: input.features.map((f) => ({
              tariffId: id,
              feature: f.feature,
              config: (f.config as Prisma.InputJsonValue) ?? undefined,
            })),
          });
        }
      }

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: auditAction,
          targetType: "Tariff",
          targetId: id,
          previousData:
            Object.keys(prevSnap).length > 0
              ? (prevSnap as Prisma.InputJsonValue)
              : undefined,
          newData:
            Object.keys(newSnap).length > 0
              ? (newSnap as Prisma.InputJsonValue)
              : undefined,
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminTariffUpdate");
  }
}

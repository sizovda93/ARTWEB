import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug: только a-z, 0-9, дефис"),
  tier: z.enum(["BASIC", "STANDARD", "PARTNER"]),
  description: z.string().max(2000).optional(),
  price: z.number().min(0),
  oldPrice: z.number().min(0).optional(),
  currency: z.string().default("RUB"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  features: z
    .array(
      z.object({
        feature: z.enum(["KNOWLEDGE_BASE_ACCESS", "AI_CHAT_ACCESS"]),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
});

/** GET /api/admin/tariffs — list all tariffs */
export async function GET() {
  try {
    await requireAdminFresh();

    const tariffs = await prisma.tariff.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tariffFeatures: true,
        tariffCourses: {
          include: { course: { select: { id: true, title: true, slug: true } } },
        },
        _count: { select: { accessGrants: true } },
      },
    });

    return NextResponse.json({ tariffs });
  } catch (error) {
    return handleApiError(error, "AdminTariffsList");
  }
}

/** POST /api/admin/tariffs — create tariff */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) {
      throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");
    }

    const body = await request.json();
    const input = createSchema.parse(body);
    const ip = getClientIp(request);

    // Check slug uniqueness
    const existing = await prisma.tariff.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw new AuthError("VALIDATION_ERROR", "Тариф с таким slug уже существует");
    }

    const tariff = await prisma.$transaction(async (tx) => {
      const created = await tx.tariff.create({
        data: {
          name: input.name,
          slug: input.slug,
          tier: input.tier,
          description: input.description,
          price: input.price,
          currency: input.currency,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      });

      // Create features
      if (input.features.length > 0) {
        await tx.tariffFeature.createMany({
          data: input.features.map((f) => ({
            tariffId: created.id,
            feature: f.feature,
            config: (f.config as Prisma.InputJsonValue) ?? undefined,
          })),
        });
      }

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "tariff_created",
          targetType: "Tariff",
          targetId: created.id,
          newData: {
            name: input.name,
            slug: input.slug,
            tier: input.tier,
            price: input.price,
            isActive: input.isActive,
          },
          ipAddress: ip,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ tariff }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminTariffCreate");
  }
}

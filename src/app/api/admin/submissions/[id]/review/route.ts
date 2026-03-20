import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { getClientIp } from "@/lib/security-log";
import { writeAuditLog } from "@/lib/audit-log";
import { handleApiError } from "@/lib/api-response";
import { reviewSubmissionSchema } from "@/lib/validations/submission";
import type { Prisma } from "@/generated/prisma/client";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/admin/submissions/[id]/review — review submission */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { id } = await params;
    const body = await request.json();
    const input = reviewSubmissionSchema.parse(body);
    const ip = getClientIp(request);

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        finalScore: true,
        finalComment: true,
        userId: true,
        assignment: { select: { title: true, type: true } },
      },
    });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Ответ не найден");

    const prevSnap: Record<string, unknown> = {
      status: existing.status,
      finalScore: existing.finalScore,
      finalComment: existing.finalComment,
    };

    await prisma.$transaction(async (tx) => {
      await tx.assignmentSubmission.update({
        where: { id },
        data: {
          status: input.status,
          finalScore: input.finalScore ?? undefined,
          finalComment: input.finalComment ?? undefined,
          reviewedBy: auth.userId,
          reviewedAt: new Date(),
        },
      });

      await writeAuditLog(
        {
          actorId: auth.userId,
          actorRole: auth.role,
          action: "submission_reviewed",
          targetType: "AssignmentSubmission",
          targetId: id,
          previousData: prevSnap as Prisma.InputJsonValue,
          newData: {
            status: input.status,
            finalScore: input.finalScore ?? null,
            finalComment: input.finalComment ?? null,
            userId: existing.userId,
            assignmentTitle: existing.assignment.title,
          } as Prisma.InputJsonValue,
          ipAddress: ip,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, status: input.status });
  } catch (error) {
    return handleApiError(error, "AdminSubmissionReview");
  }
}

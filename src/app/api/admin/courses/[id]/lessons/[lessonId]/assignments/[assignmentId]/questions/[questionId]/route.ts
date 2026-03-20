import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { handleApiError } from "@/lib/api-response";
import { updateQuestionSchema } from "@/lib/validations/assignment";

type RouteCtx = { params: Promise<{ questionId: string }> };

/** PUT — update question and options */
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { questionId } = await params;
    const body = await request.json();
    const input = updateQuestionSchema.parse(body);

    const existing = await prisma.testQuestion.findUnique({ where: { id: questionId } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Вопрос не найден");

    await prisma.$transaction(async (tx) => {
      await tx.testQuestion.update({
        where: { id: questionId },
        data: {
          text: input.text,
          explanation: input.explanation,
          isMultiSelect: input.isMultiSelect,
        },
      });

      if (input.options) {
        await tx.testOption.deleteMany({ where: { questionId } });
        await tx.testOption.createMany({
          data: input.options.map((opt, i) => ({
            questionId,
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: i,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminQuestionUpdate");
  }
}

/** DELETE — delete question */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { questionId } = await params;

    const existing = await prisma.testQuestion.findUnique({ where: { id: questionId } });
    if (!existing) throw new AuthError("VALIDATION_ERROR", "Вопрос не найден");

    await prisma.testQuestion.delete({ where: { id: questionId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AdminQuestionDelete");
  }
}

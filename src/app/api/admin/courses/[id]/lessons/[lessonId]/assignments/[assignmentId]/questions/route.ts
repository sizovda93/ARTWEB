import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { handleApiError } from "@/lib/api-response";
import { createQuestionSchema } from "@/lib/validations/assignment";

type RouteCtx = { params: Promise<{ assignmentId: string }> };

/** POST — create test question with options */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    if (!validateCsrf(request)) throw new AuthError("FORBIDDEN", "Недействительный CSRF токен");

    const { assignmentId } = await params;
    const body = await request.json();
    const input = createQuestionSchema.parse(body);

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { type: true },
    });
    if (!assignment) throw new AuthError("VALIDATION_ERROR", "Задание не найдено");
    if (assignment.type !== "TEST") {
      throw new AuthError("VALIDATION_ERROR", "Вопросы можно добавлять только к заданиям типа TEST");
    }

    const maxSort = await prisma.testQuestion.aggregate({
      where: { assignmentId },
      _max: { sortOrder: true },
    });

    const question = await prisma.testQuestion.create({
      data: {
        assignmentId,
        text: input.text,
        explanation: input.explanation,
        isMultiSelect: input.isMultiSelect,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        options: {
          create: input.options.map((opt, i) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: i,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminQuestionCreate");
  }
}

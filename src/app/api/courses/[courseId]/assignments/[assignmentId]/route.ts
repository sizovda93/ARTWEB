import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { checkLessonAccess } from "@/lib/access";
import { handleApiError } from "@/lib/api-response";
import { textSubmissionSchema, testSubmissionSchema } from "@/lib/validations/assignment";

type RouteCtx = { params: Promise<{ courseId: string; assignmentId: string }> };

/** POST — submit assignment answer (TEXT or TEST) */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAuth();
    const { courseId, assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        lesson: { select: { id: true, module: { select: { courseId: true } } } },
        questions: {
          include: { options: { select: { id: true, isCorrect: true } } },
        },
      },
    });

    if (!assignment || assignment.lesson.module.courseId !== courseId) {
      throw new AuthError("VALIDATION_ERROR", "Задание не найдено");
    }

    const hasAccess = await checkLessonAccess(auth.userId, assignment.lesson.id);
    if (!hasAccess) {
      throw new AuthError("FORBIDDEN", "Нет доступа к этому уроку");
    }

    // Check for existing pending submission
    const existing = await prisma.assignmentSubmission.findFirst({
      where: {
        userId: auth.userId,
        assignmentId,
        status: { in: ["PENDING", "REVISION_REQUESTED"] },
      },
    });

    const body = await request.json();

    if (assignment.type === "TEXT" || assignment.type === "FILE_UPLOAD") {
      const input = textSubmissionSchema.parse(body);

      if (existing) {
        // Update existing submission
        await prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: { textAnswer: input.textAnswer, status: "PENDING" },
        });
        return NextResponse.json({ submission: { id: existing.id, status: "PENDING" } });
      }

      const submission = await prisma.assignmentSubmission.create({
        data: {
          userId: auth.userId,
          assignmentId,
          textAnswer: input.textAnswer,
          status: "PENDING",
        },
      });

      return NextResponse.json({ submission: { id: submission.id, status: "PENDING" } }, { status: 201 });
    }

    if (assignment.type === "TEST") {
      const input = testSubmissionSchema.parse(body);

      // Auto-score
      let correctCount = 0;
      const totalQuestions = assignment.questions.length;

      for (const question of assignment.questions) {
        const userAnswers = input.answers[question.id] ?? [];
        const correctOptionIds = question.options
          .filter((o) => o.isCorrect)
          .map((o) => o.id);

        const isCorrect =
          userAnswers.length === correctOptionIds.length &&
          userAnswers.every((a) => correctOptionIds.includes(a));

        if (isCorrect) correctCount++;
      }

      const score = totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * assignment.maxScore)
        : 0;
      const passed = score >= assignment.maxScore * 0.7;

      if (existing) {
        await prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            testAnswers: input.answers,
            finalScore: score,
            status: passed ? "APPROVED" : "REJECTED",
          },
        });
        return NextResponse.json({
          submission: { id: existing.id, score, maxScore: assignment.maxScore, passed },
        });
      }

      const submission = await prisma.assignmentSubmission.create({
        data: {
          userId: auth.userId,
          assignmentId,
          testAnswers: input.answers,
          finalScore: score,
          status: passed ? "APPROVED" : "REJECTED",
        },
      });

      return NextResponse.json({
        submission: { id: submission.id, score, maxScore: assignment.maxScore, passed },
      }, { status: 201 });
    }

    throw new AuthError("VALIDATION_ERROR", "Неподдерживаемый тип задания");
  } catch (error) {
    return handleApiError(error, "StudentSubmission");
  }
}

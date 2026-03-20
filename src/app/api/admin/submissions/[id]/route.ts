import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/submissions/[id] — submission detail */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await requireAdminFresh();
    const { id } = await params;

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        files: { orderBy: { createdAt: "asc" } },
        assignment: {
          include: {
            questions: {
              orderBy: { sortOrder: "asc" },
              include: { options: { orderBy: { sortOrder: "asc" } } },
            },
            lesson: {
              select: {
                id: true,
                title: true,
                module: {
                  select: {
                    title: true,
                    course: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!submission) throw new AuthError("VALIDATION_ERROR", "Ответ не найден");

    return NextResponse.json({ submission });
  } catch (error) {
    return handleApiError(error, "AdminSubmissionDetail");
  }
}

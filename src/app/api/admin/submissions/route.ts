import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFresh } from "@/lib/auth";
import { handleApiError } from "@/lib/api-response";

const PAGE_SIZE = 20;

/** GET /api/admin/submissions — list submissions with filters */
export async function GET(request: NextRequest) {
  try {
    await requireAdminFresh();

    const url = request.nextUrl;
    const status = url.searchParams.get("status") ?? "all";
    const type = url.searchParams.get("type") ?? "all";
    const search = url.searchParams.get("search") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

    const where: Record<string, unknown> = {};

    if (status !== "all") where.status = status;
    if (type !== "all") where.assignment = { type };
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [submissions, total] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignment: {
            select: {
              id: true,
              title: true,
              type: true,
              maxScore: true,
              lesson: {
                select: {
                  id: true,
                  title: true,
                  module: {
                    select: {
                      course: { select: { id: true, title: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.assignmentSubmission.count({ where }),
    ]);

    const items = submissions.map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
      finalScore: s.finalScore,
      user: s.user,
      assignment: {
        id: s.assignment.id,
        title: s.assignment.title,
        type: s.assignment.type,
        maxScore: s.assignment.maxScore,
      },
      lesson: s.assignment.lesson.title,
      course: s.assignment.lesson.module.course.title,
    }));

    return NextResponse.json({ submissions: items, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
  } catch (error) {
    return handleApiError(error, "AdminSubmissionsList");
  }
}

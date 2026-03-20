import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-response";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/webinars/[id]/attend — record attendance */
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAuth();
    const { id: webinarId } = await params;

    // Find or create attendance
    const existing = await prisma.webinarAttendance.findFirst({
      where: { webinarId, userId: auth.userId, leftAt: null },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ attendance: { id: existing.id }, action: "already_joined" });
    }

    const attendance = await prisma.webinarAttendance.create({
      data: { webinarId, userId: auth.userId },
    });

    return NextResponse.json({ attendance: { id: attendance.id }, action: "joined" }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "WebinarAttend");
  }
}

/** DELETE /api/webinars/[id]/attend — record leave */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const auth = await requireAuth();
    const { id: webinarId } = await params;

    const attendance = await prisma.webinarAttendance.findFirst({
      where: { webinarId, userId: auth.userId, leftAt: null },
    });

    if (attendance) {
      await prisma.webinarAttendance.update({
        where: { id: attendance.id },
        data: { leftAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "WebinarLeave");
  }
}

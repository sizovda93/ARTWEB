import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

type RouteCtx = { params: Promise<{ path: string[] }> };

/** GET /uploads/[...path] — serve uploaded files */
export async function GET(request: NextRequest, { params }: RouteCtx) {
  const segments = (await params).path;
  const filePath = path.join(process.cwd(), "public", "uploads", ...segments);

  // Prevent path traversal
  const resolved = path.resolve(filePath);
  const uploadsDir = path.resolve(path.join(process.cwd(), "public", "uploads"));
  if (!resolved.startsWith(uploadsDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await stat(resolved);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(resolved).slice(1).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  const buffer = await readFile(resolved);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

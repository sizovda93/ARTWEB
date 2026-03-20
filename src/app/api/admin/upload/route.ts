import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { requireAdminFresh, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api-response";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/** POST /api/admin/upload — upload image file */
export async function POST(request: NextRequest) {
  try {
    await requireAdminFresh();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "covers";

    if (!file) {
      throw new AuthError("VALIDATION_ERROR", "Файл не выбран");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new AuthError("VALIDATION_ERROR", "Допустимые форматы: JPG, PNG, WebP, GIF");
    }
    if (file.size > MAX_SIZE) {
      throw new AuthError("VALIDATION_ERROR", "Максимальный размер файла: 5 МБ");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);

    const filePath = `/uploads/${folder}/${fileName}`;

    return NextResponse.json({ filePath }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "AdminUpload");
  }
}

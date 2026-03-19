import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "./auth";

/**
 * Uniform error response handler for API route handlers.
 * Handles AuthError, ZodError (v4), and unknown errors.
 */
export function handleApiError(error: unknown, label: string): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Ошибка валидации" } },
      { status: 400 },
    );
  }

  console.error(`[${label}]`, error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } },
    { status: 500 },
  );
}

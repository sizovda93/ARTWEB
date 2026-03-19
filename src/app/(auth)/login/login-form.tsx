"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@/lib/validation";
import { apiClient } from "@/lib/api-client";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
    setError,
  } = useForm<LoginInput>();

  async function onSubmit(data: LoginInput) {
    setServerError("");

    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginInput;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }

    const result = await apiClient<{ user: { role: string } }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(parsed.data),
      },
    );

    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }

    // Role-aware default: admin → admin dashboard, student → student dashboard
    const defaultRedirect =
      result.data.user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard";

    // Prevent open redirect: must start with "/" and not "//"
    const redirectTo = searchParams.get("redirect");
    const safeRedirect =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : defaultRedirect;

    router.push(safeRedirect);
    router.refresh();
  }

  return (
    <AuthCard
      title="Вход"
      footer={
        <>
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="text-blue-600 hover:underline font-medium"
          >
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <FormField
          label="Пароль"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
        >
          {isSubmitting ? "Вход..." : "Войти"}
        </button>

        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Забыли пароль?
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}

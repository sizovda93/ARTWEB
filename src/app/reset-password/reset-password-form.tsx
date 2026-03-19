"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";

interface ResetPasswordFields {
  password: string;
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
    setError,
  } = useForm<ResetPasswordFields>();

  if (!token) {
    return (
      <AuthCard title="Ошибка">
        <p className="text-center text-sm text-gray-600">
          Ссылка недействительна. Токен сброса пароля отсутствует.
        </p>
        <Link
          href="/forgot-password"
          className="block mt-4 text-center text-sm text-blue-600 hover:underline font-medium"
        >
          Запросить новую ссылку
        </Link>
      </AuthCard>
    );
  }

  async function onSubmit(data: ResetPasswordFields) {
    setServerError("");

    if (data.password.length < 8) {
      setError("password", {
        message: "Пароль должен содержать минимум 8 символов",
      });
      return;
    }
    if (data.password.length > 128) {
      setError("password", { message: "Пароль слишком длинный" });
      return;
    }

    const result = await apiClient("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password: data.password }),
    });

    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <AuthCard title="Пароль изменён">
        <div className="text-center text-sm text-gray-600">
          <p className="mb-4">
            Пароль успешно изменён. Все сессии завершены.
          </p>
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Войти с новым паролем
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Новый пароль">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <FormField
          label="Новый пароль"
          type="password"
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          error={errors.password?.message}
          {...register("password")}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
        >
          {isSubmitting ? "Сохранение..." : "Сохранить пароль"}
        </button>
      </form>
    </AuthCard>
  );
}

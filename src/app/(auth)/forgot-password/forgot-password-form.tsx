"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation";
import { apiClient } from "@/lib/api-client";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
    setError,
  } = useForm<ForgotPasswordInput>();

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError("");

    const parsed = forgotPasswordSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ForgotPasswordInput;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }

    const result = await apiClient("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthCard title="Проверьте почту">
        <div className="text-center text-sm text-gray-600">
          <p className="mb-4">
            Если аккаунт с таким email существует, мы отправили инструкции по
            сбросу пароля.
          </p>
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Вернуться к входу
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Восстановление пароля"
      footer={
        <>
          Вспомнили пароль?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Войти
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
        >
          {isSubmitting ? "Отправка..." : "Отправить ссылку"}
        </button>
      </form>
    </AuthCard>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { registerSchema, type RegisterInput } from "@/lib/validation";
import { apiClient } from "@/lib/api-client";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";

export function RegisterForm() {
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
    setError,
  } = useForm<RegisterInput>();

  async function onSubmit(data: RegisterInput) {
    setServerError("");

    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RegisterInput;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }

    const result = await apiClient("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    if (!result.ok) {
      if (result.error.code === "CONFLICT") {
        setError("email", { message: result.error.message });
      } else {
        setServerError(result.error.message);
      }
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <AuthCard title="Регистрация завершена">
        <div className="text-center text-sm text-gray-600">
          <p className="mb-4">
            На ваш email отправлено письмо для подтверждения. Перейдите по ссылке
            в письме.
          </p>
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Перейти к входу
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Регистрация"
      footer={
        <>
          Уже есть аккаунт?{" "}
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Имя"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <FormField
            label="Фамилия"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

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
          {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>
    </AuthCard>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { AuthCard } from "@/components/auth/auth-card";

type Status = "verifying" | "success" | "error";

export function VerifyEmailHandler() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Токен верификации отсутствует");
      return;
    }

    let cancelled = false;

    apiClient("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.error.message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "verifying") {
    return (
      <AuthCard title="Подтверждение email">
        <p className="text-center text-sm text-gray-600">Проверяем токен...</p>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard title="Email подтверждён">
        <div className="text-center text-sm text-gray-600">
          <p className="mb-4">Ваш email успешно подтверждён.</p>
          <Link
            href="/"
            className="text-blue-600 hover:underline font-medium"
          >
            Перейти на главную
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Ошибка верификации">
      <div className="text-center text-sm text-gray-600">
        <p className="mb-4 text-red-600">{errorMessage}</p>
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

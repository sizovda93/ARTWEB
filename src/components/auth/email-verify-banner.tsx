"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

export function EmailVerifyBanner() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  async function handleResend() {
    setStatus("sending");
    const result = await apiClient("/api/auth/resend-verification", {
      method: "POST",
    });
    setStatus(result.ok ? "sent" : "error");
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 w-full">
      <p>
        Email не подтверждён. Некоторые функции недоступны.
        {status === "idle" && (
          <button
            onClick={handleResend}
            className="ml-2 underline hover:no-underline font-medium"
          >
            Отправить повторно
          </button>
        )}
        {status === "sending" && <span className="ml-2">Отправка...</span>}
        {status === "sent" && (
          <span className="ml-2 text-green-700">Письмо отправлено!</span>
        )}
        {status === "error" && (
          <span className="ml-2 text-red-600">Ошибка отправки</span>
        )}
      </p>
    </div>
  );
}

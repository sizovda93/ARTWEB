import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сброс пароля — ARTWEB",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

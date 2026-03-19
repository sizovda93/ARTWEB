import { Suspense } from "react";
import { VerifyEmailHandler } from "./verify-email-handler";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Подтверждение email — ARTWEB",
};

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense>
        <VerifyEmailHandler />
      </Suspense>
    </div>
  );
}

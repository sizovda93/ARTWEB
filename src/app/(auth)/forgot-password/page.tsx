import { ForgotPasswordForm } from "./forgot-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Восстановление пароля — ARTWEB",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}

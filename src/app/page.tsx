import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export default async function Home() {
  const auth = await getAuthContext();

  if (auth) {
    redirect(auth.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <main className="flex flex-col items-center gap-8 text-center max-w-md w-full px-4">
        <h1 className="text-4xl font-bold text-gray-900">ARTWEB</h1>
        <p className="text-lg text-gray-600">Образовательная платформа</p>

        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Регистрация
          </Link>
        </div>

        <span className="rounded-full bg-green-100 px-4 py-2 text-sm text-green-800">
          Платформа запущена
        </span>
      </main>
    </div>
  );
}

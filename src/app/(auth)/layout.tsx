import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthContext();
  if (auth) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      {children}
    </div>
  );
}

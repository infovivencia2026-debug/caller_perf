import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/caller");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Telecaller Performance</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">Sign in to continue</p>
        <LoginForm />
      </div>
    </main>
  );
}

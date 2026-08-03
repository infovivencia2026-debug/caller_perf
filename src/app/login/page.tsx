import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/caller");

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Soft brand glow behind the card. */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/20" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-bold text-white shadow-md shadow-emerald-500/30">
            TP
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Telecaller Performance</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

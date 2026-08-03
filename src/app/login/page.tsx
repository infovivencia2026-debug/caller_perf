import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/caller");

  return (
    <main className="relative flex flex-1 items-center justify-center p-6">
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-none border-2 border-black bg-black text-lg font-bold text-white shadow-[4px_4px_0_0_#0a0a0a] dark:border-white dark:bg-white dark:text-black dark:shadow-[4px_4px_0_0_#e5e5e5]">
            TP
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-black dark:text-white">Telecaller Performance</h1>
          <p className="mt-1 text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

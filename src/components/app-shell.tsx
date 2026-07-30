import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import MainNav from "@/components/main-nav";
import { secondaryButtonClass } from "@/components/ui";
import type { Session } from "@/lib/auth";

export default function AppShell({
  session,
  nav,
  children,
}: {
  session: Session;
  nav: { href: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <span className="mr-2 font-semibold">Telecaller Performance</span>
          <MainNav items={nav} />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {session.name} · {session.role === "ADMIN" ? "Admin" : "Telecaller"}
            </span>
            <form action={logout}>
              <button type="submit" className={secondaryButtonClass}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>
    </div>
  );
}

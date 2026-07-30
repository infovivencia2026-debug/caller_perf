import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import Sidebar from "@/components/sidebar";
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
      <Sidebar
        items={nav}
        userName={session.name}
        roleLabel={session.role === "ADMIN" ? "Admin" : "Telecaller"}
        signOut={
          <form action={logout}>
            <button type="submit" className={`${secondaryButtonClass} w-full`}>
              Sign out
            </button>
          </form>
        }
      />
      {/* Offset by the sidebar width from lg up; full width below that. */}
      <main className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 lg:ml-64">{children}</main>
    </div>
  );
}

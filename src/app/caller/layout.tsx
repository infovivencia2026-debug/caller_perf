import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import { requireCaller } from "@/lib/auth";

const NAV = [
  { href: "/caller", label: "Dashboard" },
  { href: "/caller/call", label: "Calling screen" },
  { href: "/caller/should-call", label: "Should call" },
  { href: "/caller/my-calls", label: "My calls" },
  { href: "/caller/customers/new", label: "Add customer" },
  { href: "/caller/follow-ups", label: "Follow-ups" },
];

export default async function CallerLayout({ children }: { children: ReactNode }) {
  const session = await requireCaller();
  return (
    <AppShell session={session} nav={NAV}>
      {children}
    </AppShell>
  );
}

import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/summary", label: "Daily summary" },
  { href: "/admin/calls", label: "Call log" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/callers", label: "Telecallers" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  return (
    <AppShell session={session} nav={NAV}>
      <AutoRefresh />
      {children}
    </AppShell>
  );
}

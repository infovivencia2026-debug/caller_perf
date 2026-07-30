import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/customers/import", label: "Import" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  return (
    <AppShell session={session} nav={NAV}>
      {children}
    </AppShell>
  );
}

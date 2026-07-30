"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "@/components/ui";

export default function MainNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

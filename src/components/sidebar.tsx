"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Full-height navigation rail. Fixed and always visible from `lg` up; below that it
 * slides in over the content from a toggle in the slim mobile top bar.
 */
export default function Sidebar({
  items,
  userName,
  roleLabel,
  signOut,
}: {
  items: { href: string; label: string }[];
  userName: string;
  roleLabel: string;
  signOut: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Only the most specific match is active, so a section root like /caller does not
  // stay highlighted while a child route like /caller/call is open.
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-black bg-white px-4 py-3 lg:hidden dark:border-white dark:bg-black">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          className="rounded-none border-2 border-black p-2 text-black dark:border-white dark:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2 4h14M2 9h14M2 14h14" />}
          </svg>
        </button>
        <span className="font-semibold">Telecaller Performance</span>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r-2 border-black bg-white transition-transform duration-200 dark:border-white dark:bg-black ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 border-b-2 border-black px-5 py-4 dark:border-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border-2 border-black bg-black text-sm font-bold text-white dark:border-white dark:bg-white dark:text-black">
            TP
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase leading-tight tracking-wide text-black dark:text-white">Telecaller</p>
            <p className="text-xs uppercase leading-tight tracking-wide text-neutral-500 dark:text-neutral-400">Performance</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {items.map((item) => {
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-none border-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                      active
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-transparent text-black hover:border-black hover:bg-black hover:text-white dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t-2 border-black p-4 dark:border-white">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-sm font-bold text-black dark:border-white dark:bg-black dark:text-white">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-black dark:text-white">{userName}</p>
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{roleLabel}</p>
            </div>
          </div>
          <ThemeToggle />
          {signOut}
        </div>
      </aside>
    </>
  );
}

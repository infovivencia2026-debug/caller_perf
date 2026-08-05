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
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200/70 bg-white/80 px-4 py-3 backdrop-blur lg:hidden dark:border-neutral-800 dark:bg-black/70">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          className="rounded-lg border border-neutral-300 p-2 text-black transition-colors hover:border-indigo-400 dark:border-neutral-700 dark:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2 4h14M2 9h14M2 14h14" />}
          </svg>
        </button>
        <span className="font-semibold">Counsellor Performance</span>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-200/70 bg-white/75 shadow-[4px_0_24px_-12px_rgb(15_15_30/0.35)] backdrop-blur-xl transition-transform duration-200 dark:border-neutral-800 dark:bg-black/60 dark:shadow-[4px_0_28px_-12px_rgb(0_0_0/0.8)] ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 border-b border-neutral-200/70 px-5 py-4 dark:border-neutral-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/40 bg-gradient-to-b from-indigo-500 to-indigo-600 text-sm font-bold text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3),0_6px_14px_-6px_rgb(99_102_241/0.8)]">
            TP
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase leading-tight tracking-wide text-black dark:text-white">Counsellor</p>
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
                    className={`block rounded-lg border px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                      active
                        ? "border-indigo-500/40 bg-gradient-to-b from-indigo-500/20 to-indigo-500/10 text-indigo-700 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6),0_4px_12px_-6px_rgb(99_102_241/0.7)] dark:border-indigo-400/40 dark:text-indigo-200 dark:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_4px_14px_-6px_rgb(99_102_241/0.6)]"
                        : "border-transparent text-neutral-600 hover:border-neutral-300 hover:bg-black/5 hover:text-black dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-white/5 dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-neutral-200/70 p-4 dark:border-neutral-800">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-sm font-bold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
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

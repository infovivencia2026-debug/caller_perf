import type { ReactNode } from "react";

/* Bento system: soft rounded surfaces, hairline borders, one subtle coloured glow per
   tile, JetBrains Mono kept for the numerals. Colour stays quiet — a tint on the edge
   and behind the header, never a slab of it. The `.bento` primitives live in
   globals.css so plain elements (popovers, details panels) can opt in too. */

export function Card({
  title,
  children,
  action,
  glow = "indigo",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  glow?: Glow;
}) {
  return (
    <section data-glow={glow} className="bento p-5">
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export type Glow = "indigo" | "violet" | "emerald" | "amber" | "sky" | "rose";

/**
 * A tile on a bento board — soft rounded surface with one subtle coloured glow.
 * Used on the caller's own screens; the rest of the app keeps the hard-edged `Card`.
 * `span` is the column count on the 12-wide grid at `lg` and up (stacks below).
 */
export function BentoTile({
  title,
  children,
  action,
  glow = "indigo",
  span = 12,
  /** Drops the tile's own padding so content (a table, say) can run edge-to-edge. */
  flush = false,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  glow?: Glow;
  span?: 3 | 4 | 5 | 7 | 8 | 12;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section data-glow={glow} className={`bento bento-span-${span} ${flush ? "" : "p-5"} ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** A single big number on the bento board. */
export function BentoStat({
  label,
  value,
  hint,
  glow = "indigo",
  span = 3,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  glow?: Glow;
  span?: 3 | 4 | 5 | 7 | 8 | 12;
}) {
  return (
    <div data-glow={glow} className={`bento bento-span-${span} p-5`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

/** Softer, rounded button that sits with the bento surfaces. */
export const bentoButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-indigo-700 transition-colors hover:bg-indigo-500/20 disabled:opacity-50 disabled:pointer-events-none dark:border-indigo-400/40 dark:text-indigo-200";

export const bentoGhostButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-transparent px-4 py-2 text-sm font-bold uppercase tracking-wide text-neutral-700 transition-colors hover:border-neutral-500 hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-400 dark:hover:text-white";

/** Rounded input to match the bento tiles. */
export const bentoInputClass =
  "w-full rounded-xl border border-neutral-300 bg-white/60 px-3 py-2 text-sm text-black outline-none transition-colors placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-neutral-700 dark:bg-white/5 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-indigo-400";

export type StatAccent ="indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

export function Stat({
  label,
  value,
  hint,
  icon,
  accent = "indigo",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: StatAccent;
  icon?: ReactNode;
}) {
  // The old `accent` names map onto the glow palette, so every existing caller keeps
  // its colour coding without being touched.
  const glow = ACCENT_GLOW[accent] ?? "indigo";
  return (
    <div data-glow={glow} className="bento p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        {icon && <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>}
      </div>
      <p className="mt-3 text-4xl font-extrabold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

const ACCENT_GLOW: Record<StatAccent, Glow> = {
  indigo: "indigo",
  emerald: "emerald",
  amber: "amber",
  rose: "rose",
  sky: "sky",
  violet: "violet",
  slate: "indigo",
};

/** One label/value line inside a definition list. Shared by the customer detail views. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 font-medium uppercase text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex min-w-[104px] items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

type Tone = "slate" | "green" | "red" | "amber" | "blue";

// Tinted pills: a translucent fill and a matching border, so the colour reads as a
// glow on the surface rather than a printed slab. Same weights in both themes.
const TONES: Record<Tone, string> = {
  slate: "border-neutral-400/40 bg-neutral-400/15 text-neutral-700 dark:text-neutral-300",
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  red: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  blue: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

export function statusTone(status: string): Tone {
  if (["INTERESTED", "SALE_CLOSED", "CLOSED", "MEETING_SCHEDULED", "COMPLETED"].includes(status)) return "green";
  if (["NOT_INTERESTED", "INVALID", "INVALID_NUMBER", "WRONG_NUMBER", "MISSED"].includes(status)) return "red";
  if (["CALLBACK", "CALLBACK_REQUESTED", "BUSY", "NO_ANSWER", "SWITCHED_OFF", "PENDING"].includes(status)) return "amber";
  if (["IN_PROGRESS", "EXISTING_CUSTOMER"].includes(status)) return "blue";
  return "slate";
}

/* The app-wide input and button styles are now the bento ones — every existing page
   imports these names, so restyling here restyles the whole app. */

export const inputClass = bentoInputClass;
export const buttonClass = bentoButtonClass;
export const secondaryButtonClass = bentoGhostButtonClass;

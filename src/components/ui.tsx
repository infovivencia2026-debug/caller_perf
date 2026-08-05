import type { ReactNode } from "react";

/* Brutalist system: square corners, thin 1px black borders, no shadows, JetBrains Mono,
   black-on-white (inverted in dark). Accent colour is reserved for semantic badges;
   everything structural is monochrome. */

export function Card({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-none border border-black bg-white p-5 dark:border-white dark:bg-black">
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-black pb-3 dark:border-white">
          {title && (
            <h2 className="text-sm font-bold uppercase tracking-wide text-black dark:text-white">{title}</h2>
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: StatAccent;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-none border border-black bg-white p-5 dark:border-white dark:bg-black">
      <div className="flex items-center justify-between border-b border-black pb-2 dark:border-white">
        <span className="text-[11px] font-bold uppercase tracking-widest text-black dark:text-white">{label}</span>
        {icon && <span className="text-black dark:text-white">{icon}</span>}
      </div>
      <p className="mt-3 text-4xl font-extrabold tabular-nums leading-none text-black dark:text-white">{value}</p>
      {hint && <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

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
      className={`inline-flex min-w-[104px] items-center justify-center rounded-none border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

type Tone = "slate" | "green" | "red" | "amber" | "blue";

// Solid fills with a hard black (or white, in dark) border — bold and even-sized.
const TONES: Record<Tone, string> = {
  slate: "border-black bg-neutral-200 text-black dark:border-white dark:bg-neutral-700 dark:text-white",
  green: "border-black bg-emerald-300 text-black dark:border-white dark:bg-emerald-600 dark:text-white",
  red: "border-black bg-red-300 text-black dark:border-white dark:bg-red-600 dark:text-white",
  amber: "border-black bg-amber-300 text-black dark:border-white dark:bg-amber-500 dark:text-black",
  blue: "border-black bg-sky-300 text-black dark:border-white dark:bg-sky-600 dark:text-white",
};

export function statusTone(status: string): Tone {
  if (["INTERESTED", "SALE_CLOSED", "CLOSED", "MEETING_SCHEDULED", "COMPLETED"].includes(status)) return "green";
  if (["NOT_INTERESTED", "INVALID", "INVALID_NUMBER", "WRONG_NUMBER", "MISSED"].includes(status)) return "red";
  if (["CALLBACK", "CALLBACK_REQUESTED", "BUSY", "NO_ANSWER", "SWITCHED_OFF", "PENDING"].includes(status)) return "amber";
  if (["IN_PROGRESS", "EXISTING_CUSTOMER"].includes(status)) return "blue";
  return "slate";
}

export const inputClass =
  "w-full rounded-none border border-black bg-white px-3 py-2 text-sm text-black outline-none transition-colors placeholder:text-neutral-500 focus:outline focus:outline-1 focus:outline-offset-2 focus:outline-black dark:border-white dark:bg-black dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white";

export const buttonClass =
  "inline-flex items-center justify-center rounded-none border border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50 disabled:pointer-events-none dark:border-white dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-none border border-black bg-white px-4 py-2 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50 disabled:pointer-events-none dark:border-white dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black";

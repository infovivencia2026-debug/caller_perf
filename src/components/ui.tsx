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
    <section data-glow={glow} className="bento p-4">
      {(title || action) && (
        <header className="mb-2.5 flex items-center justify-between gap-3">
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
    <section data-glow={glow} className={`bento bento-span-${span} ${flush ? "" : "p-4"} ${className}`}>
      {(title || action) && (
        <header className="mb-2.5 flex items-center justify-between gap-3">
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
    <div data-glow={glow} className={`bento bento-span-${span} p-4`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

/**
 * Primary action. Raised rather than tinted-flat: a gradient face, a lit top lip
 * (the inset white line), a contact shadow and a coloured ambient one. It presses
 * in on :active, which is what makes it feel like a physical button.
 */
export const bentoButtonClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-indigo-500/50 bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),0_1px_2px_0_rgb(15_15_30/0.2),0_8px_16px_-8px_rgb(99_102_241/0.8)] transition-all hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3),0_2px_4px_0_rgb(15_15_30/0.22),0_12px_22px_-8px_rgb(99_102_241/0.9)] active:translate-y-0 active:shadow-[inset_0_2px_4px_0_rgb(15_15_30/0.3)] disabled:opacity-50 disabled:pointer-events-none";

/** Secondary action: a raised neutral surface, same lighting, no colour. */
export const bentoGhostButtonClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-neutral-300 bg-gradient-to-b from-white to-neutral-100 px-4 py-2 text-sm font-bold uppercase tracking-wide text-neutral-700 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.9),0_1px_2px_0_rgb(15_15_30/0.1),0_6px_14px_-8px_rgb(15_15_30/0.25)] transition-all hover:-translate-y-px hover:text-black hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.9),0_2px_4px_0_rgb(15_15_30/0.12),0_10px_20px_-8px_rgb(15_15_30/0.3)] active:translate-y-0 active:shadow-[inset_0_2px_4px_0_rgb(15_15_30/0.18)] disabled:opacity-50 disabled:pointer-events-none dark:border-neutral-700 dark:from-neutral-800 dark:to-neutral-900 dark:text-neutral-200 dark:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.07),0_1px_2px_0_rgb(0_0_0/0.5),0_8px_18px_-10px_rgb(0_0_0/0.8)] dark:hover:text-white";

/**
 * Inputs read as recessed — the opposite lighting to the buttons: a soft inner
 * shadow at the top edge, as though the field were pressed into the tile.
 */
export const bentoInputClass =
  "w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-black shadow-[inset_0_2px_4px_-2px_rgb(15_15_30/0.15)] outline-none transition-shadow placeholder:text-neutral-400 focus:border-indigo-400 focus:shadow-[inset_0_2px_4px_-2px_rgb(15_15_30/0.12),0_0_0_3px_rgb(99_102_241/0.18)] dark:border-neutral-700 dark:bg-black/40 dark:text-white dark:shadow-[inset_0_2px_4px_-2px_rgb(0_0_0/0.6)] dark:placeholder:text-neutral-500 dark:focus:border-indigo-400";

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
    <div data-glow={glow} className="bento p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        {icon && <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>}
      </div>
      <p className="mt-1.5 text-3xl font-extrabold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
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
      className={`inline-flex w-[8.5rem] max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-[inset_0_1px_0_0_rgb(255_255_255/0.5)] dark:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)] ${TONES[tone]}`}
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

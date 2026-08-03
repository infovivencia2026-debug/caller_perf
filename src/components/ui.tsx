import type { ReactNode } from "react";

/* Brutalist system: square corners, 2px black borders, hard offset shadows, JetBrains
   Mono, black-on-white (inverted in dark). Accent colour is reserved for semantic badges;
   everything structural is monochrome. */

const CARD_SHADOW = "shadow-[4px_4px_0_0_#0a0a0a] dark:shadow-[4px_4px_0_0_#e5e5e5]";

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
    <section className={`rounded-none border-2 border-black bg-white p-5 dark:border-white dark:bg-black ${CARD_SHADOW}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3 border-b-2 border-black pb-3 dark:border-white">
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

export type StatAccent = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

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
    <div
      className={`group rounded-none border-2 border-black bg-white p-5 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 dark:border-white dark:bg-black ${CARD_SHADOW}`}
    >
      <div className="flex items-center justify-between border-b-2 border-black pb-2 dark:border-white">
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
      className={`inline-flex min-w-[104px] items-center justify-center rounded-none border-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONES[tone]}`}
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
  "w-full rounded-none border-2 border-black bg-white px-3 py-2 text-sm text-black outline-none transition-shadow placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-black dark:border-white dark:bg-black dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white";

export const buttonClass =
  "inline-flex items-center justify-center rounded-none border-2 border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:-translate-x-0 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-white hover:text-black hover:shadow-[1px_1px_0_0_#0a0a0a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none dark:border-white dark:bg-white dark:text-black dark:shadow-[3px_3px_0_0_#e5e5e5] dark:hover:bg-black dark:hover:text-white dark:hover:shadow-[1px_1px_0_0_#e5e5e5]";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase tracking-wide text-black shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-black hover:text-white hover:shadow-[1px_1px_0_0_#0a0a0a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none dark:border-white dark:bg-black dark:text-white dark:shadow-[3px_3px_0_0_#e5e5e5] dark:hover:bg-white dark:hover:text-black";

import type { ReactNode } from "react";

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
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export type StatAccent = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

// Accent per stat on the light cards: a tinted icon chip, a corner glow and a fading underline.
const STAT_ACCENTS: Record<StatAccent, { text: string; chip: string; bar: string; glow: string }> = {
  indigo: { text: "text-indigo-600", chip: "bg-indigo-50", bar: "from-indigo-500", glow: "bg-indigo-300/30" },
  emerald: { text: "text-emerald-600", chip: "bg-emerald-50", bar: "from-emerald-500", glow: "bg-emerald-300/30" },
  amber: { text: "text-orange-600", chip: "bg-orange-50", bar: "from-orange-500", glow: "bg-orange-300/30" },
  rose: { text: "text-rose-600", chip: "bg-rose-50", bar: "from-rose-500", glow: "bg-rose-300/30" },
  sky: { text: "text-sky-600", chip: "bg-sky-50", bar: "from-sky-500", glow: "bg-sky-300/30" },
  violet: { text: "text-violet-600", chip: "bg-violet-50", bar: "from-violet-500", glow: "bg-violet-300/30" },
  slate: { text: "text-slate-600", chip: "bg-slate-100", bar: "from-slate-400", glow: "bg-slate-300/40" },
};

export function Stat({
  label,
  value,
  hint,
  accent = "indigo",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: StatAccent;
  icon?: ReactNode;
}) {
  const tone = STAT_ACCENTS[accent];
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      {/* Soft accent glow in the corner. */}
      <span className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl ${tone.glow}`} aria-hidden="true" />
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.chip} ${tone.text}`}>{icon}</span>
        )}
      </div>
      <p className="relative mt-4 text-[2rem] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {hint && <p className="relative mt-2 text-xs font-medium text-slate-500">{hint}</p>}
      <span
        className={`relative mt-5 block h-1 w-full rounded-full bg-linear-to-r ${tone.bar} to-transparent`}
        aria-hidden="true"
      />
    </div>
  );
}

/** One label/value line inside a definition list. Shared by the customer detail views. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

type Tone = "slate" | "green" | "red" | "amber" | "blue";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
};

export function statusTone(status: string): Tone {
  if (["INTERESTED", "SALE_CLOSED", "CLOSED", "MEETING_SCHEDULED", "COMPLETED"].includes(status)) return "green";
  if (["NOT_INTERESTED", "INVALID", "INVALID_NUMBER", "WRONG_NUMBER", "MISSED"].includes(status)) return "red";
  if (["CALLBACK", "CALLBACK_REQUESTED", "BUSY", "NO_ANSWER", "SWITCHED_OFF", "PENDING"].includes(status)) return "amber";
  if (["IN_PROGRESS", "EXISTING_CUSTOMER"].includes(status)) return "blue";
  return "slate";
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15";

export const buttonClass =
  "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-indigo-500/25 disabled:opacity-50 disabled:pointer-events-none";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

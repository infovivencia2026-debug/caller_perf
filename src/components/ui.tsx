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
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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

const STAT_ACCENTS: Record<StatAccent, { bar: string; chip: string }> = {
  indigo: { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-600" },
  emerald: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-600" },
  amber: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-600" },
  rose: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-600" },
  sky: { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-600" },
  violet: { bar: "bg-violet-500", chip: "bg-violet-50 text-violet-600" },
  slate: { bar: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
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
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
            {icon}
          </span>
        )}
      </div>
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

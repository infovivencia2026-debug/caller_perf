/**
 * Small server-rendered charts, plain HTML/CSS (no chart library, no client JS).
 * Magnitude data → a single data hue with labels carrying identity (never a rainbow).
 * Theme-aware via Tailwind dark: classes; a native title tooltip on each mark; the
 * track/axis stays recessive so the data reads first.
 */

const BAR = "bg-black dark:bg-white";
const TRACK = "border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900";

/** Vertical bars over time — e.g. calls per day. */
export function TimeBars({ data }: { data: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {/* items-stretch makes every column the full 10rem tall, so the bar's percentage
          height is measured against a real height rather than collapsing to its content. */}
      <div className="flex h-40 items-stretch gap-1">
        {data.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col" title={`${d.label}: ${d.value}`}>
            <span className="mb-0.5 text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {d.value || ""}
            </span>
            <div className="flex flex-1 items-end">
              <div
                className={`w-full rounded-t-md transition-[height] duration-500 ease-out hover:opacity-80 ${
                  d.value > 0 ? BAR : "bg-neutral-200 dark:bg-neutral-800"
                }`}
                style={{ height: d.value > 0 ? `${(d.value / max) * 100}%` : "2px" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal magnitude bars — e.g. call outcomes. Sorted, labelled, single hue. */
export function RankedBars({ data }: { data: { label: string; value: number }[] }) {
  const rows = [...data].sort((a, b) => b.value - a.value).filter((d) => d.value > 0);
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No calls in this period.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((d) => (
        <li key={d.label} title={`${d.label}: ${d.value}`}>
          <div className="mb-0.5 flex justify-between text-sm">
            <span>{d.label}</span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">{d.value}</span>
          </div>
          <div className={`group/rb relative h-4 overflow-hidden rounded-full ${TRACK}`}>
            <div
              className={`h-full transition-[width] duration-500 ease-out group-hover/rb:opacity-80 ${BAR}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

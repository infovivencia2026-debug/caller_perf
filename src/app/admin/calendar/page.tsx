import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, statusTone } from "@/components/ui";
import { CONVERTED_STATUSES, SUCCESS_STATUSES, formatDuration, humanize } from "@/lib/labels";
import { percent } from "@/lib/metrics";
import { istDayKey } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayStat = {
  total: number;
  successful: number;
  converted: number;
  duration: number;
  byStatus: Record<string, number>;
};

function monthLabel(year: number, month0: number) {
  return new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ caller?: string; month?: string; day?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const caller = callers.find((c) => c.id === params.caller) ?? callers[0];

  // Selected month (YYYY-MM), defaulting to the current India-time month.
  const todayKey = istDayKey(new Date());
  const [curY, curM] = todayKey.split("-").map(Number);
  const m = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : `${curY}-${String(curM).padStart(2, "0")}`;
  const [year, month] = m.split("-").map(Number); // month is 1-based
  const month0 = month - 1;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month0, 1)).getUTCDay() + 6) % 7; // Monday = 0

  const prev = month0 === 0 ? `${year - 1}-12` : `${year}-${String(month0).padStart(2, "0")}`;
  const next = month0 === 11 ? `${year + 1}-01` : `${year}-${String(month0 + 2).padStart(2, "0")}`;
  const q = (over: Record<string, string>) =>
    "?" + new URLSearchParams({ caller: caller?.id ?? "", month: m, ...over }).toString();

  const byDay = new Map<string, DayStat>();
  const attendance = new Set<string>();

  if (caller) {
    // Fetch calls spanning the month (with a day of slack on each side for the IST offset),
    // then bucket by India-time day.
    const from = new Date(Date.UTC(year, month0, 1) - 24 * 3600 * 1000);
    const to = new Date(Date.UTC(year, month0 + 1, 1) + 24 * 3600 * 1000);
    const [calls, present] = await Promise.all([
      prisma.call.findMany({
        where: { callerId: caller.id, startedAt: { gte: from, lt: to } },
        select: { startedAt: true, status: true, duration: true },
      }),
      prisma.attendance.findMany({
        where: {
          userId: caller.id,
          date: { gte: new Date(Date.UTC(year, month0, 1)), lt: new Date(Date.UTC(year, month0 + 1, 1)) },
        },
        select: { date: true },
      }),
    ]);

    for (const call of calls) {
      const key = istDayKey(call.startedAt);
      if (!key.startsWith(m)) continue;
      const stat = byDay.get(key) ?? { total: 0, successful: 0, converted: 0, duration: 0, byStatus: {} };
      stat.total += 1;
      stat.duration += call.duration;
      if (SUCCESS_STATUSES.includes(call.status)) stat.successful += 1;
      if (CONVERTED_STATUSES.includes(call.status)) stat.converted += 1;
      stat.byStatus[call.status] = (stat.byStatus[call.status] ?? 0) + 1;
      byDay.set(key, stat);
    }
    for (const row of present) attendance.add(istDayKey(row.date));
  }

  const dayKey = (d: number) => `${m}-${String(d).padStart(2, "0")}`;
  const selectedDay = params.day && params.day.startsWith(m) ? params.day : undefined;
  const selected = selectedDay ? byDay.get(selectedDay) : undefined;

  // Cells: leading blanks then each day.
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="month" value={m} />
          <select
            name="caller"
            defaultValue={caller?.id ?? ""}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {callers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
            View
          </button>
        </form>
      </div>

      {!caller ? (
        <Card title="Calendar">
          <p className="text-sm text-slate-500 dark:text-slate-400">No counsellors yet.</p>
        </Card>
      ) : (
        <>
          <Card
            title={`${caller.name} — ${monthLabel(year, month0)}`}
            action={
              <div className="flex items-center gap-2 text-sm">
                <Link href={q({ month: prev, day: "" })} className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700">
                  ← Prev
                </Link>
                <Link href={q({ month: next, day: "" })} className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700">
                  Next →
                </Link>
              </div>
            }
          >
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={`b${i}`} />;
                const key = dayKey(day);
                const stat = byDay.get(key);
                const present = attendance.has(key);
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                return (
                  <Link
                    key={key}
                    href={q({ day: key })}
                    className={`flex min-h-[4.5rem] flex-col rounded-md border p-1.5 text-left transition-colors ${
                      isSelected
                        ? "border-slate-500 bg-slate-100 dark:border-slate-400 dark:bg-slate-800"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`text-xs ${isToday ? "font-bold" : "text-slate-500 dark:text-slate-400"}`}>
                        {day}
                      </span>
                      {present && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Present" />}
                    </span>
                    {stat ? (
                      <span className="mt-auto text-xs">
                        <span className="font-semibold tabular-nums">{stat.total}</span> call
                        {stat.total === 1 ? "" : "s"}
                        {stat.converted > 0 && (
                          <span className="block text-emerald-600 dark:text-emerald-400">{stat.converted} closed</span>
                        )}
                      </span>
                    ) : (
                      <span className="mt-auto text-xs text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </Link>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> present · number = calls that day · click a day
              for details
            </p>
          </Card>

          {selectedDay && (
            <Card title={`Details — ${selectedDay}`}>
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                <Badge tone={attendance.has(selectedDay) ? "green" : "slate"}>
                  {attendance.has(selectedDay) ? "Present" : "Not marked present"}
                </Badge>
                {selected ? (
                  <span className="text-slate-600 dark:text-slate-300">
                    {selected.total} calls · {selected.successful} successful · {selected.converted} closed ·{" "}
                    {percent(selected.converted, selected.total)}% conversion · {formatDuration(selected.duration)} talk
                    time
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">No calls logged this day.</span>
                )}
              </div>
              {selected && (
                <div>
                  <p className="mb-2 text-sm font-medium">Responses</p>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(selected.byStatus)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <li key={status} className="flex items-center gap-2">
                          <Badge tone={statusTone(status)}>{humanize(status)}</Badge>
                          <span className="tabular-nums text-slate-500 dark:text-slate-400">{count}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

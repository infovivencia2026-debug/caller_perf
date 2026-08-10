import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Card, Badge, buttonClass, statusTone } from "@/components/ui";
import { customerLabel, humanize } from "@/lib/labels";
import { formatShortTime, istDayKey } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(year: number, month0: number) {
  return new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A counsellor's own calendar of scheduled callbacks (pending follow-ups), by the day
 * they're due. Click a day to see that day's callbacks and jump straight into the call.
 */
export default async function CallerCalendar({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const session = await requireCaller();
  const params = await searchParams;

  const todayKey = istDayKey(new Date());
  const [curY, curM] = todayKey.split("-").map(Number);
  const m = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : `${curY}-${String(curM).padStart(2, "0")}`;
  const [year, month] = m.split("-").map(Number);
  const month0 = month - 1;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month0, 1)).getUTCDay() + 6) % 7;
  const prev = month0 === 0 ? `${year - 1}-12` : `${year}-${String(month0).padStart(2, "0")}`;
  const next = month0 === 11 ? `${year + 1}-01` : `${year}-${String(month0 + 2).padStart(2, "0")}`;
  const q = (over: Record<string, string>) => "?" + new URLSearchParams({ month: m, ...over }).toString();

  // Pending follow-ups due in this month (a day of slack each side for the IST offset).
  const from = new Date(Date.UTC(year, month0, 1) - 24 * 3600 * 1000);
  const to = new Date(Date.UTC(year, month0 + 1, 1) + 24 * 3600 * 1000);
  const followUps = await prisma.followUp.findMany({
    where: { callerId: session.userId, status: "PENDING", dueAt: { gte: from, lt: to } },
    orderBy: { dueAt: "asc" },
    include: { customer: { select: { id: true, name: true, phone: true, status: true } } },
  });

  const byDay = new Map<string, typeof followUps>();
  for (const fu of followUps) {
    const key = istDayKey(fu.dueAt);
    if (!key.startsWith(m)) continue;
    const list = byDay.get(key) ?? [];
    list.push(fu);
    byDay.set(key, list);
  }

  const dayKey = (d: number) => `${m}-${String(d).padStart(2, "0")}`;
  const selectedDay = params.day && params.day.startsWith(m) ? params.day : undefined;
  const selected = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Your scheduled callbacks</p>
      </div>

      <Card
        title={monthLabel(year, month0)}
        action={
          <div className="flex items-center gap-2 text-sm">
            <Link href={q({ month: prev, day: "" })} className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700">
              ← Prev
            </Link>
            <Link href={q({ month: next, day: "" })} className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700">
              Next →
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
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
            const list = byDay.get(key);
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            return (
              <Link
                key={key}
                href={q({ day: key })}
                className={`flex min-h-[4.5rem] flex-col rounded-md border p-1.5 text-left transition-colors ${
                  isSelected
                    ? "border-neutral-500 bg-neutral-100 dark:border-neutral-400 dark:bg-neutral-800"
                    : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                }`}
              >
                <span className={`text-xs ${isToday ? "font-bold" : "text-neutral-500 dark:text-neutral-400"}`}>{day}</span>
                {list ? (
                  <span className="mt-auto text-xs">
                    <span className="font-semibold tabular-nums">{list.length}</span> callback
                    {list.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="mt-auto text-xs text-neutral-300 dark:text-neutral-600">—</span>
                )}
              </Link>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card title={`Callbacks on ${selectedDay}`}>
          {selected.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No callbacks scheduled this day.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {selected.map((fu) => (
                <li
                  key={fu.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <span className="font-semibold">
                      {customerLabel(fu.customer ?? { name: fu.customerName, phone: fu.customerPhone })}
                    </span>
                    <span className="ml-2 tabular-nums text-neutral-500 dark:text-neutral-400">
                      {fu.customer?.phone ?? fu.customerPhone}
                    </span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                      Due {formatShortTime(fu.dueAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(fu.customer?.status ?? fu.customerStatus) && (
                      <Badge tone={statusTone(fu.customer?.status ?? fu.customerStatus ?? "")}>
                        {humanize(fu.customer?.status ?? fu.customerStatus ?? "")}
                      </Badge>
                    )}
                    {fu.customer ? (
                      <Link href={`/caller/call?focus=${fu.customer.id}`} className={buttonClass}>
                        Call
                      </Link>
                    ) : (
                      <Badge tone="slate">lead deleted</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

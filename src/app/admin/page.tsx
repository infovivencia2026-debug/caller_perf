import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, Stat, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { RankedBars, TimeBars } from "@/components/charts";
import { formatDuration, humanize } from "@/lib/labels";
import { endOfDay, getStats, percent, startOfDay } from "@/lib/metrics";
import { istDayKey, formatShortTime, minutesSince } from "@/lib/datetime";
import { RANGES, resolveFilters } from "@/lib/report-filters";
import { dayDate, syncPresentFromWorkforce } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; caller?: string }>;
}) {
  const filters = resolveFilters(await searchParams);
  const callWindow = { from: filters.from, to: filters.to };

  // --- Live team board (always "today", independent of the period filter) ---
  await syncPresentFromWorkforce();
  const liveCallers = await prisma.user.findMany({
    where: { role: "TELECALLER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, dailyTarget: true },
  });
  const presentToday = await prisma.attendance.findMany({ where: { date: dayDate() }, select: { userId: true } });
  const presentSet = new Set(presentToday.map((r) => r.userId));
  const dayStart = startOfDay();
  const dayEnd = endOfDay();
  const team = await Promise.all(
    liveCallers.map(async (c) => {
      const [callsToday, last] = await Promise.all([
        prisma.call.count({ where: { callerId: c.id, startedAt: { gte: dayStart, lt: dayEnd } } }),
        prisma.call.findFirst({ where: { callerId: c.id }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
      ]);
      const present = presentSet.has(c.id);
      const idleMins = last ? minutesSince(last.startedAt) : null;
      return {
        ...c,
        present,
        callsToday,
        lastAt: last?.startedAt ?? null,
        idleMins,
        // Present but no call in 20+ minutes (or none yet) — worth a glance.
        idle: present && (idleMins === null || idleMins >= 20),
      };
    }),
  );
  const presentCount = team.filter((t) => t.present).length;

  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, dailyTarget: true, active: true },
  });

  // A caller filter narrows the customer figures to the customers assigned to them.
  const customerWhere = filters.callerId ? { assignedToId: filters.callerId } : {};

  const [stats, pendingFollowUps, totalCustomers, statusBreakdown] = await Promise.all([
    getStats({ ...callWindow, ...(filters.callerId ? { callerId: filters.callerId } : {}) }),
    prisma.followUp.count({
      where: { status: "PENDING", ...(filters.callerId ? { callerId: filters.callerId } : {}) },
    }),
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.groupBy({
      by: ["status"],
      where: customerWhere,
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),
  ]);

  const visibleCallers = filters.callerId ? callers.filter((c) => c.id === filters.callerId) : callers;
  const callerRows = await Promise.all(
    visibleCallers.map(async (caller) => ({
      ...caller,
      stats: await getStats({ callerId: caller.id, ...callWindow }),
    })),
  );
  const busiest = Math.max(1, ...callerRows.map((row) => row.stats.totalCalls));
  const selectedCaller = callers.find((c) => c.id === filters.callerId);

  // --- Chart data ---
  const callerCallWhere = filters.callerId ? { callerId: filters.callerId } : {};

  // Calls per day for the last 14 days (India time), regardless of the period filter.
  const chartFrom = new Date();
  chartFrom.setDate(chartFrom.getDate() - 13);
  chartFrom.setHours(0, 0, 0, 0);
  const recentCalls = await prisma.call.findMany({
    where: { startedAt: { gte: chartFrom }, ...callerCallWhere },
    select: { startedAt: true },
  });
  const counts = new Map<string, number>();
  for (const call of recentCalls) {
    const key = istDayKey(call.startedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(chartFrom);
    d.setDate(d.getDate() + i);
    const key = istDayKey(d);
    return { key, label: key.slice(8), value: counts.get(key) ?? 0 }; // label = day of month
  });

  // Call outcomes over the selected period.
  const outcomeGroups = await prisma.call.groupBy({
    by: ["status"],
    where: {
      ...callerCallWhere,
      ...(callWindow.from || callWindow.to
        ? { startedAt: { ...(callWindow.from ? { gte: callWindow.from } : {}), ...(callWindow.to ? { lt: callWindow.to } : {}) } }
        : {}),
    },
    _count: { _all: true },
  });
  const outcomes = outcomeGroups.map((g) => ({ label: humanize(g.status), value: g._count._all }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Admin dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filters.label}
          {selectedCaller ? ` · ${selectedCaller.name}` : " · all telecallers"}
        </p>
      </div>

      {/* Live team board — refreshes with the page's auto-refresh, so it reads like a
          real-time floor view of who's in and who's working. */}
      <Card title={`Team — live (${presentCount} present)`}>
        {team.length === 0 ? (
          <p className="text-sm text-slate-500">No active telecallers.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Telecaller</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Calls today</th>
                  <th className="px-3 py-2 font-medium">Progress</th>
                  <th className="px-3 py-2 font-medium">Last call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {team.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2">
                      {t.present ? (
                        t.idle ? (
                          <Badge tone="amber">idle{t.idleMins !== null ? ` ${t.idleMins}m` : ""}</Badge>
                        ) : (
                          <Badge tone="green">on the floor</Badge>
                        )
                      ) : (
                        <Badge tone="slate">absent</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {t.callsToday}
                      <span className="text-slate-400"> / {t.dailyTarget}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-indigo-600"
                            style={{ width: `${Math.min(100, percent(t.callsToday, t.dailyTarget))}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-slate-500">
                          {percent(t.callsToday, t.dailyTarget)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {t.lastAt ? (
                        <>
                          {formatShortTime(t.lastAt)}
                          {t.idleMins !== null && <span className="text-slate-400"> · {t.idleMins}m ago</span>}
                        </>
                      ) : (
                        "no calls yet"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* A GET form: filters end up in the URL, so the view is shareable and needs no JS. */}
      <Card title="Filters">
        <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm font-medium">
            Period
            <select name="range" defaultValue={filters.range} className={`${inputClass} mt-1`}>
              {RANGES.map((range) => (
                <option key={range.key} value={range.key}>
                  {range.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            From
            <input type="date" name="from" defaultValue={filters.fromInput} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm font-medium">
            To
            <input type="date" name="to" defaultValue={filters.toInput} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm font-medium">
            Telecaller
            <select name="caller" defaultValue={filters.callerId} className={`${inputClass} mt-1`}>
              <option value="">All telecallers</option>
              {callers.map((caller) => (
                <option key={caller.id} value={caller.id}>
                  {caller.name}
                  {caller.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={buttonClass}>
              Apply
            </button>
            {filters.isFiltered && (
              <Link href="/admin" className={secondaryButtonClass}>
                Reset
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5 dark:text-slate-400">
            From and To apply when Period is set to “Custom range”.
          </p>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Calls" value={stats.totalCalls} hint={filters.label} />
        <Stat
          label="Successful contacts"
          value={stats.successfulCalls}
          hint={`${percent(stats.successfulCalls, stats.totalCalls)}% of calls`}
        />
        <Stat label="Interested leads" value={stats.interestedLeads} />
        <Stat label="Closed leads" value={stats.convertedLeads} />
        <Stat label="Avg call duration" value={formatDuration(stats.avgDuration)} />
        <Stat label="Talk time" value={formatDuration(stats.totalDuration)} />
        <Stat label="Pending follow-ups" value={pendingFollowUps} hint="Current, not period-based" />
        {/* Roster size is deliberately not narrowed by the filters — it describes the
            team, not the selected period. */}
        <Stat
          label="Total telecallers"
          value={callers.length}
          hint={`${callers.filter((c) => c.active).length} active`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Calls per day (last 14 days)">
          <TimeBars data={perDay} />
        </Card>
        <Card title={`Call outcomes (${filters.label.toLowerCase()})`}>
          <RankedBars data={outcomes} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Conversion (${filters.label.toLowerCase()})`}>
          <div className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums">{stats.conversionRate}%</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stats.convertedLeads} closed of {stats.totalCalls} calls · {stats.successfulCalls} successful
              contacts
            </p>
            <Bar value={stats.conversionRate} />
          </div>
        </Card>

        <Card
          title="Customer status distribution"
          action={
            <Link href="/admin/customers" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              View all
            </Link>
          }
        >
          {statusBreakdown.length === 0 ? (
            <Empty>No customers yet — import a CSV to get started.</Empty>
          ) : (
            <ul className="space-y-2">
              {statusBreakdown.map((row) => (
                <li key={row.status} className="text-sm">
                  <div className="flex justify-between">
                    <span>{humanize(row.status)}</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {row._count._all} ({percent(row._count._all, totalCustomers)}%)
                    </span>
                  </div>
                  <Bar value={percent(row._count._all, totalCustomers)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={`Calls per caller (${filters.label.toLowerCase()})`}>
        {callerRows.length === 0 ? (
          <Empty>No telecallers yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {callerRows.map((row) => (
              <li key={row.id} className="text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {row.name}
                    {!row.active && <span className="ml-2 text-xs text-slate-400">inactive</span>}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {row.stats.totalCalls} calls · {row.stats.conversionRate}% conversion ·{" "}
                    {formatDuration(row.stats.avgDuration)} avg
                    {filters.range === "today" && ` · ${percent(row.stats.totalCalls, row.dailyTarget)}% of target`}
                  </span>
                </div>
                <Bar value={(row.stats.totalCalls / busiest) * 100} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-indigo-600"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

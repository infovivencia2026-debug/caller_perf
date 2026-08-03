import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, buttonClass, inputClass, secondaryButtonClass, statusTone } from "@/components/ui";
import { customerLabel, formatDuration, humanize } from "@/lib/labels";
import { formatDateTime, formatShortTime } from "@/lib/datetime";
import { RANGES, resolveFilters } from "@/lib/report-filters";

export const dynamic = "force-dynamic";

/** How many calls to show at once — keeps the page fast without server-side paging UI. */
const PAGE_SIZE = 200;

/**
 * A flat, filterable log of every call any telecaller has made: who called whom, when
 * they pressed Start and End, how long it ran, the outcome and their notes. This is the
 * admin's drill-down behind the dashboard's aggregate numbers.
 */
export default async function AdminCallLog({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; caller?: string }>;
}) {
  const filters = resolveFilters(await searchParams);

  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  const where = {
    ...(filters.callerId ? { callerId: filters.callerId } : {}),
    ...(filters.from || filters.to
      ? { startedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
      : {}),
  };

  const [total, calls] = await Promise.all([
    prisma.call.count({ where }),
    prisma.call.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        duration: true,
        status: true,
        response: true,
        comments: true,
        caller: { select: { name: true } },
        customer: { select: { name: true, phone: true, company: true } },
      },
    }),
  ]);

  const selectedCaller = callers.find((c) => c.id === filters.callerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Call log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filters.label}
          {selectedCaller ? ` · ${selectedCaller.name}` : " · all telecallers"} · {total} call
          {total === 1 ? "" : "s"}
        </p>
      </div>

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
              <Link href="/admin/calls" className={secondaryButtonClass}>
                Reset
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5 dark:text-slate-400">
            From and To apply when Period is set to “Custom range”. Defaults to this month.
          </p>
        </form>
      </Card>

      <Card
        title="Calls"
        action={
          total > calls.length ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Showing latest {calls.length} of {total} — narrow the period to see older calls.
            </span>
          ) : undefined
        }
      >
        {calls.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No calls in this period. Try “All time”, or a different telecaller.
          </p>
        ) : (
          {/* Scrolls inside the card (both directions) so a long call list doesn't stretch
              the whole page; the header stays pinned while you scroll. */}
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium">Ended</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Telecaller</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">Response / notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {calls.map((call) => (
                  <tr key={call.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(call.startedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-500 dark:text-slate-400">
                      {formatShortTime(call.endedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDuration(call.duration)}</td>
                    <td className="px-3 py-2">{call.caller.name}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{customerLabel(call.customer)}</span>
                      <span className="block text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {call.customer.phone}
                        {call.customer.company ? ` · ${call.customer.company}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {call.response || call.comments ? (
                        <span className="block max-w-[22rem] whitespace-pre-wrap">
                          {[call.response, call.comments].filter(Boolean).join(" — ")}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

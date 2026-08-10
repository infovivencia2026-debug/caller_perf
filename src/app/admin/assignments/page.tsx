import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Card, Badge, buttonClass, inputClass } from "@/components/ui";
import { humanize } from "@/lib/labels";
import { formatDateTime, istDayKey } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** Activity-log actions that concern who leads were assigned to. */
const ASSIGNMENT_ACTIONS = [
  "AUTO_ASSIGNED",
  "LIST_ASSIGNED",
  "LIST_SPLIT",
  "LIST_UNASSIGNED",
  "LIST_DELETED",
  "LIST_DELETED_WITH_LEADS",
  "LEADS_GROUPED",
] as const;

/** Local-day (IST) bounds from a "YYYY-MM-DD" string; the server runs in IST. */
function dayStart(key: string) {
  return new Date(`${key}T00:00:00`);
}
function dayEnd(key: string) {
  return new Date(`${key}T23:59:59.999`);
}

export default async function AssignmentLog({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; action?: string }>;
}) {
  await requireAdmin();
  const { from, to, action } = await searchParams;

  const today = istDayKey(new Date());
  // Default to the last 7 days when nothing is chosen.
  const fromKey = from || istDayKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const toKey = to || today;

  const actionFilter =
    action && (ASSIGNMENT_ACTIONS as readonly string[]).includes(action)
      ? [action]
      : [...ASSIGNMENT_ACTIONS];

  const logs = await prisma.activityLog.findMany({
    where: {
      action: { in: actionFilter },
      createdAt: { gte: dayStart(fromKey), lte: dayEnd(toKey) },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Assignment history</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">{logs.length} entries</p>
      </div>

      <Card title="Filter">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            From
            <input type="date" name="from" defaultValue={fromKey} max={today} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium">
            To
            <input type="date" name="to" defaultValue={toKey} max={today} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium">
            Action
            <select name="action" defaultValue={action ?? ""} className={`${inputClass} mt-1`}>
              <option value="">All assignment actions</option>
              {ASSIGNMENT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {humanize(a)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass}>
            Apply
          </button>
        </form>
      </Card>

      <Card title={`${fromKey} → ${toKey}`}>
        {logs.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No assignment activity in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-bold">Date &amp; time</th>
                  <th className="px-3 py-2 font-bold">Action</th>
                  <th className="px-3 py-2 font-bold">By</th>
                  <th className="px-3 py-2 font-bold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Badge>{humanize(log.action)}</Badge>
                    </td>
                    <td className="px-3 py-2">{log.user?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{log.detail ?? "—"}</td>
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

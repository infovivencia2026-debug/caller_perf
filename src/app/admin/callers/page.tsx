import { autoAssign, createCaller, unassignCaller, updateDailyTarget } from "@/app/actions/callers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { DeleteCallerButton } from "./delete-caller-button";
import { CLOSED_STATUSES } from "@/lib/queue";
import { endOfDay, percent, startOfDay } from "@/lib/metrics";
import { dayDate, syncPresentFromWorkforce } from "@/lib/attendance";
import { formatDateTime } from "@/lib/datetime";
import { humanize } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CallersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { ok, error } = await searchParams;

  // Reflect workforce-os punch-ins before showing who's present.
  await syncPresentFromWorkforce();

  const openWhere = { status: { notIn: CLOSED_STATUSES as unknown as never } };
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [callers, unassigned, presentRows, assignLogs] = await Promise.all([
    // Deleted counsellors are soft-removed (active=false) so their calls survive; hide them
    // from the roster here — their history stays visible in the Call log and reports.
    prisma.user.findMany({
      where: { role: "TELECALLER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, dailyTarget: true, active: true },
    }),
    prisma.customer.count({ where: { assignedToId: null, ...openWhere } }),
    prisma.attendance.findMany({ where: { date: dayDate() }, select: { userId: true } }),
    // Stored assignment history — who assigned what, when.
    prisma.activityLog.findMany({
      where: { action: { in: ["CUSTOMERS_ASSIGNED", "AUTO_ASSIGNED", "AUTO_ASSIGN_SCHEDULED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);
  const presentIds = new Set(presentRows.map((r) => r.userId));

  const rows = await Promise.all(
    callers.map(async (caller) => {
      const [queued, callsToday] = await Promise.all([
        prisma.customer.count({ where: { assignedToId: caller.id, ...openWhere } }),
        prisma.call.count({
          where: { callerId: caller.id, startedAt: { gte: today, lt: tomorrow } },
        }),
      ]);
      return { ...caller, queued, callsToday, present: presentIds.has(caller.id) };
    }),
  );

  const presentCount = rows.filter((row) => row.active && row.present).length;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Counsellors</h1>

      {ok && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Card title="Add a counsellor">
        <form action={createCaller} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Name
            <input name="name" required maxLength={80} placeholder="Full name" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              placeholder="name@yourcompany.com"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium">
            Password (optional)
            <PasswordInput
              name="password"
              minLength={8}
              placeholder="Leave blank for default: onrol@ai"
              className={`${inputClass} mt-1`}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
              Leave blank and the counsellor gets the default password{" "}
              <span className="font-mono">onrol@ai</span>. Share it so they can sign in.
            </span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonClass}>
              Add counsellor
            </button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The daily target is set automatically when you run auto-assign.
            </p>
          </div>
        </form>
      </Card>

      <Card title="Auto-assign customers">
        <div className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Set a target and split the unassigned customers equally among counsellors marked
            present today, up to that many each. The target becomes their daily target. Highest
            priority and longest waiting go out first; it is safe to run again to top everyone up.
          </p>
          <form action={autoAssign} className="flex flex-wrap items-end gap-3">
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              <strong>{unassigned}</strong> unassigned · <strong>{presentCount}</strong> present today
            </span>
            <label className="block text-sm font-medium">
              Target per counsellor
              <input
                type="number"
                name="target"
                min={1}
                max={500}
                step={1}
                required
                defaultValue={50}
                className={`${inputClass} mt-1 w-28`}
              />
            </label>
            <button type="submit" className={buttonClass} disabled={unassigned === 0 || presentCount === 0}>
              Auto-assign equally
            </button>
          </form>
        </div>
      </Card>

      <Card title="Daily targets">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No counsellors yet.</p>
        ) : (
          <div className="stack-table-wrap table-scroll max-w-full">
            <table className="stack-table w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Counsellor</th>
                  <th className="px-3 py-2">Calls today</th>
                  <th className="px-3 py-2">In queue</th>
                  <th className="px-3 py-2">Daily target</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.name}</span>
                      {row.active && row.present && (
                        <span className="ml-2">
                          <Badge tone="green">present</Badge>
                        </span>
                      )}
                      {!row.active && (
                        <span className="ml-2">
                          <Badge tone="slate">inactive</Badge>
                        </span>
                      )}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{row.email}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.callsToday}
                      <span className="text-slate-500 dark:text-slate-400">
                        {" "}
                        ({percent(row.callsToday, row.dailyTarget)}%)
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.queued}</td>
                    <td className="px-3 py-2">
                      <form action={updateDailyTarget} className="flex items-center gap-2">
                        <input type="hidden" name="callerId" value={row.id} />
                        <input
                          type="number"
                          name="dailyTarget"
                          min={0}
                          max={500}
                          step={1}
                          required
                          defaultValue={row.dailyTarget}
                          aria-label={`Daily target for ${row.name}`}
                          className={`${inputClass} w-24`}
                        />
                        <button type="submit" className={secondaryButtonClass}>
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Return this counsellor's untouched (never-called) leads to the pool.
                            Leave the count blank to return all untouched leads. */}
                        <form action={unassignCaller} className="flex items-center gap-1">
                          <input type="hidden" name="callerId" value={row.id} />
                          <input
                            type="number"
                            name="count"
                            min={1}
                            max={row.queued || undefined}
                            step={1}
                            placeholder="all"
                            aria-label={`How many leads to unassign from ${row.name}`}
                            className={`${inputClass} w-20`}
                          />
                          <button type="submit" className={secondaryButtonClass} disabled={row.queued === 0}>
                            Unassign
                          </button>
                        </form>
                        <DeleteCallerButton callerId={row.id} name={row.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Stored assignment history — every manual / quick / auto / scheduled assignment. */}
      <Card title={`Assignment history (${assignLogs.length})`}>
        {assignLogs.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No assignments recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {assignLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                  {formatDateTime(log.createdAt)}
                </span>
                <Badge tone="blue">{humanize(log.action)}</Badge>
                <span className="font-bold">{log.user?.name ?? "system"}</span>
                <span className="text-neutral-600 dark:text-neutral-300">{log.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

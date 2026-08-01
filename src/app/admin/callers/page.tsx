import { autoAssign, createCaller, updateDailyTarget } from "@/app/actions/callers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { CLOSED_STATUSES } from "@/lib/queue";
import { endOfDay, percent, startOfDay } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function CallersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { ok, error } = await searchParams;

  const openWhere = { status: { notIn: CLOSED_STATUSES as unknown as never } };
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [callers, unassigned] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TELECALLER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, dailyTarget: true, active: true },
    }),
    prisma.customer.count({ where: { assignedToId: null, ...openWhere } }),
  ]);

  const rows = await Promise.all(
    callers.map(async (caller) => {
      const [queued, callsToday] = await Promise.all([
        prisma.customer.count({ where: { assignedToId: caller.id, ...openWhere } }),
        prisma.call.count({
          where: { callerId: caller.id, startedAt: { gte: today, lt: tomorrow } },
        }),
      ]);
      return { ...caller, queued, callsToday };
    }),
  );

  const activeCallers = rows.filter((row) => row.active).length;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Telecallers</h1>

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

      <Card title="Add a telecaller">
        <form action={createCaller} className="grid gap-4 sm:grid-cols-2">
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
              placeholder="Leave blank for default: password123"
              className={`${inputClass} mt-1`}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
              Leave blank and the telecaller gets the default password{" "}
              <span className="font-mono">password123</span>. Share it so they can sign in.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Daily target
            <input
              type="number"
              name="dailyTarget"
              min={0}
              max={500}
              step={1}
              required
              defaultValue={50}
              className={`${inputClass} mt-1`}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonClass}>
              Add telecaller
            </button>
          </div>
        </form>
      </Card>

      <Card title="Auto-assign customers">
        <div className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Set a target and split the unassigned customers equally among active telecallers, up to
            that many each. The target becomes every telecaller&apos;s daily target. Highest priority
            and longest waiting go out first; it is safe to run again to top everyone up.
          </p>
          <form action={autoAssign} className="flex flex-wrap items-end gap-3">
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              <strong>{unassigned}</strong> unassigned · <strong>{activeCallers}</strong> active telecallers
            </span>
            <label className="block text-sm font-medium">
              Target per telecaller
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
            <button type="submit" className={buttonClass} disabled={unassigned === 0 || activeCallers === 0}>
              Auto-assign equally
            </button>
          </form>
        </div>
      </Card>

      <Card title="Daily targets">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No telecallers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Telecaller</th>
                  <th className="px-3 py-2">Calls today</th>
                  <th className="px-3 py-2">In queue</th>
                  <th className="px-3 py-2">Daily target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.name}</span>
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

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Stat } from "@/components/ui";
import { formatDuration, humanize } from "@/lib/labels";
import { endOfDay, getStats, percent, startOfDay, startOfMonth, startOfWeek } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [
    totalCallers,
    activeCallers,
    monthStats,
    todayCount,
    weekCount,
    pendingFollowUps,
    interestedLeads,
    closedLeads,
    perCaller,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "TELECALLER" } }),
    prisma.user.count({ where: { role: "TELECALLER", active: true } }),
    getStats({ from: startOfMonth() }),
    prisma.call.count({ where: { startedAt: { gte: today, lt: tomorrow } } }),
    prisma.call.count({ where: { startedAt: { gte: startOfWeek() } } }),
    prisma.followUp.count({ where: { status: "PENDING" } }),
    prisma.customer.count({ where: { status: "INTERESTED" } }),
    prisma.customer.count({ where: { status: "CLOSED" } }),
    prisma.user.findMany({
      where: { role: "TELECALLER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, dailyTarget: true, active: true },
    }),
  ]);

  const callerRows = await Promise.all(
    perCaller.map(async (caller) => ({
      ...caller,
      today: await getStats({ callerId: caller.id, from: today, to: tomorrow }),
    })),
  );
  const maxToday = Math.max(1, ...callerRows.map((row) => row.today.totalCalls));

  const statusBreakdown = await prisma.customer.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { _count: { status: "desc" } },
  });
  const totalCustomers = statusBreakdown.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Admin dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total telecallers" value={totalCallers} hint={`${activeCallers} active`} />
        <Stat label="Calls today" value={todayCount} />
        <Stat label="Calls this week" value={weekCount} />
        <Stat label="Calls this month" value={monthStats.totalCalls} />
        <Stat label="Pending follow-ups" value={pendingFollowUps} />
        <Stat label="Interested leads" value={interestedLeads} />
        <Stat label="Closed leads" value={closedLeads} />
        <Stat
          label="Avg call duration"
          value={formatDuration(monthStats.avgDuration)}
          hint="This month"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Conversion (this month)">
          <div className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums">{monthStats.conversionRate}%</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {monthStats.convertedLeads} closed of {monthStats.totalCalls} calls ·{" "}
              {monthStats.successfulCalls} successful contacts
            </p>
            <Bar value={monthStats.conversionRate} />
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

      <Card title="Calls per caller (today)">
        {callerRows.length === 0 ? (
          <Empty>No telecallers yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {callerRows.map((row) => (
              <li key={row.id} className="text-sm">
                <div className="flex justify-between">
                  <span>
                    {row.name}
                    {!row.active && <span className="ml-2 text-xs text-slate-400">inactive</span>}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {row.today.totalCalls}/{row.dailyTarget} calls ·{" "}
                    {percent(row.today.totalCalls, row.dailyTarget)}% of target
                  </span>
                </div>
                <Bar value={(row.today.totalCalls / maxToday) * 100} />
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
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className="h-full rounded-full bg-slate-900 dark:bg-slate-200"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

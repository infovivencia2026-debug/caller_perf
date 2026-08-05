import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, Stat, buttonClass, statusTone } from "@/components/ui";
import { callLead, customerLabel, formatDuration, humanize } from "@/lib/labels";
import { endOfDay, getStats, isOverdue, percent, startOfDay } from "@/lib/metrics";
import { getNextCustomer, getQueueCount } from "@/lib/queue";
import { formatDateTime, formatShortTime } from "@/lib/datetime";
import { syncPresentFromWorkforce } from "@/lib/attendance";
import { AutoRefresh } from "@/components/auto-refresh";
import { FollowUpAlerts } from "@/components/follow-up-alerts";
import { IconBell, IconCheck, IconPhone, IconTarget } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CallerDashboard() {
  const session = await requireCaller();
  // Presence is driven by workforce-os punch-ins, so there's no manual button here — just
  // keep attendance in sync in the background.
  await syncPresentFromWorkforce();
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [me, todayStats, next, queueCount, pendingFollowUps, dueToday, recentCalls] =
    await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { dailyTarget: true } }),
    getStats({ callerId: session.userId, from: today, to: tomorrow }),
    getNextCustomer(session.userId),
    getQueueCount(session.userId),
    prisma.followUp.count({ where: { callerId: session.userId, status: "PENDING" } }),
    prisma.followUp.findMany({
      where: { callerId: session.userId, status: "PENDING", dueAt: { lt: tomorrow } },
      orderBy: { dueAt: "asc" },
      take: 10,
      include: { customer: { select: { id: true, name: true, phone: true } } },
    }),
    prisma.call.findMany({
      where: { callerId: session.userId },
      orderBy: { startedAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        startedAt: true,
        duration: true,
        customer: { select: { name: true, phone: true } },
        customerPhone: true,
        customerName: true,
      },
    }),
  ]);

  const target = me?.dailyTarget ?? 0;
  const remaining = Math.max(0, target - todayStats.totalCalls);

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <FollowUpAlerts
        items={dueToday.map((f) => ({
          id: f.id,
          name: customerLabel(f.customer),
          dueAt: f.dueAt.toISOString(),
        }))}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Hello, {session.name}</h1>
        {/* Attendance comes from workforce-os punch-ins — no manual present button here. */}
        <Link href="/caller/call" className={buttonClass}>
          Start calling
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Today's target"
          value={target}
          hint={`${percent(todayStats.totalCalls, target)}% achieved`}
          accent="indigo"
          icon={<IconTarget />}
        />
        <Stat label="Calls completed" value={todayStats.totalCalls} accent="emerald" icon={<IconCheck />} />
        <Stat
          label="Calls remaining"
          value={remaining}
          hint={`${queueCount} customers in queue`}
          accent="amber"
          icon={<IconPhone />}
        />
        <Stat
          label="Pending follow-ups"
          value={pendingFollowUps}
          accent="rose"
          icon={<IconBell />}
          hint={
            pendingFollowUps === 0
              ? "None scheduled"
              : `${dueToday.length} due today · ${Math.max(0, pendingFollowUps - dueToday.length)} upcoming`
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Next customer">
          {next ? (
            <div className="space-y-2 text-sm">
              <p className="text-base font-semibold">{customerLabel(next)}</p>
              <p className="tabular-nums text-slate-600 dark:text-slate-300">{next.phone}</p>
              <p className="text-slate-500 dark:text-slate-400">
                {next.company ?? "No company"} · {next.city ?? "No city"} · {humanize(next.priority)} priority
              </p>
              <Link href="/caller/call" className={`${buttonClass} mt-2`}>
                Open calling screen
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nothing left in your queue. Ask your admin to assign more customers.
            </p>
          )}
        </Card>

        <Card title="Daily performance summary">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <SummaryRow label="Successful contacts" value={todayStats.successfulCalls} />
            <SummaryRow label="Interested" value={todayStats.interestedLeads} />
            <SummaryRow label="Closed" value={todayStats.convertedLeads} />
            <SummaryRow label="Conversion rate" value={`${todayStats.conversionRate}%`} />
            <SummaryRow label="Avg duration" value={formatDuration(todayStats.avgDuration)} />
            <SummaryRow label="Talk time" value={formatDuration(todayStats.totalDuration)} />
          </dl>
        </Card>
      </div>

      <Card title="Follow-ups due today">
        {dueToday.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No follow-ups due today.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dueToday.map((followUp) => (
              <li key={followUp.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={isOverdue(followUp.dueAt) ? "red" : "amber"}>
                  {formatShortTime(followUp.dueAt)}
                </Badge>
                <span className="font-medium">{customerLabel(followUp.customer)}</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">{followUp.customer.phone}</span>
                {followUp.notes && <span className="w-full text-slate-600 dark:text-slate-300">{followUp.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent activity">
        {recentCalls.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No calls logged yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentCalls.map((call) => (
              <li key={call.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                <span className="font-medium">{customerLabel(callLead(call))}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatDateTime(call.startedAt)} · {formatDuration(call.duration)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

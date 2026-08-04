import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, Stat, buttonClass, inputClass } from "@/components/ui";
import { formatDuration } from "@/lib/labels";
import { getStats, percent, startOfDay, endOfDay } from "@/lib/metrics";
import { istDayKey } from "@/lib/datetime";
import { dayDate, syncPresentFromWorkforce } from "@/lib/attendance";
import { IconPhone, IconCheck, IconStar, IconTrophy, IconClock, IconUsers } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * End-of-day report: team totals plus a per-telecaller breakdown for one chosen day.
 * Defaults to today (India time). A quick way to see who did what without touching the
 * period filters on the main dashboard.
 */
export default async function DailySummary({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();
  const { date } = await searchParams;

  const today = istDayKey(new Date());
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  // Server runs in IST, so a bare datetime string parses as IST midnight.
  const from = startOfDay(new Date(`${day}T00:00:00`));
  const to = endOfDay(from);

  await syncPresentFromWorkforce();

  const [team, present, callers] = await Promise.all([
    getStats({ from, to }),
    prisma.attendance.findMany({ where: { date: dayDate(from) }, select: { userId: true } }),
    prisma.user.findMany({
      where: { role: "TELECALLER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, dailyTarget: true },
    }),
  ]);
  const presentSet = new Set(present.map((p) => p.userId));

  const rows = await Promise.all(
    callers.map(async (c) => ({
      ...c,
      present: presentSet.has(c.id),
      stats: await getStats({ callerId: c.id, from, to }),
    })),
  );

  const presentCount = rows.filter((r) => r.present).length;
  const prettyDay = new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Daily summary</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {prettyDay} · {presentCount}/{callers.length} present
        </p>
      </div>

      <Card title="Choose a day">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Date
            <input type="date" name="date" defaultValue={day} max={today} className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" className={buttonClass}>
            Show
          </button>
          {day !== today && (
            <Link href="/admin/summary" className="self-end text-sm font-bold uppercase underline">
              Today
            </Link>
          )}
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Calls" value={team.totalCalls} accent="indigo" icon={<IconPhone />} />
        <Stat
          label="Successful contacts"
          value={team.successfulCalls}
          hint={`${percent(team.successfulCalls, team.totalCalls)}% of calls`}
          accent="sky"
          icon={<IconCheck />}
        />
        <Stat label="Interested" value={team.interestedLeads} accent="violet" icon={<IconStar />} />
        <Stat label="Closed" value={team.convertedLeads} accent="emerald" icon={<IconTrophy />} />
        <Stat label="Talk time" value={formatDuration(team.totalDuration)} accent="amber" icon={<IconClock />} />
        <Stat label="Present" value={`${presentCount}/${callers.length}`} accent="slate" icon={<IconUsers />} />
      </div>

      <Card title="Per telecaller">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No telecallers.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-bold">Telecaller</th>
                  <th className="px-3 py-2 font-bold">Present</th>
                  <th className="px-3 py-2 font-bold">Calls</th>
                  <th className="px-3 py-2 font-bold">Target</th>
                  <th className="px-3 py-2 font-bold">Contacts</th>
                  <th className="px-3 py-2 font-bold">Interested</th>
                  <th className="px-3 py-2 font-bold">Closed</th>
                  <th className="px-3 py-2 font-bold">Conversion</th>
                  <th className="px-3 py-2 font-bold">Talk time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-bold">{r.name}</td>
                    <td className="px-3 py-2">
                      {r.present ? <Badge tone="green">present</Badge> : <Badge tone="slate">absent</Badge>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.stats.totalCalls}</td>
                    <td className="px-3 py-2 tabular-nums text-neutral-500">{r.dailyTarget}</td>
                    <td className="px-3 py-2 tabular-nums">{r.stats.successfulCalls}</td>
                    <td className="px-3 py-2 tabular-nums">{r.stats.interestedLeads}</td>
                    <td className="px-3 py-2 tabular-nums">{r.stats.convertedLeads}</td>
                    <td className="px-3 py-2 tabular-nums">{r.stats.conversionRate}%</td>
                    <td className="px-3 py-2 tabular-nums">{formatDuration(r.stats.totalDuration)}</td>
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

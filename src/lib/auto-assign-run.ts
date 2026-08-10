import { prisma } from "@/lib/prisma";
import { CLOSED_STATUSES } from "@/lib/queue";
import { dayDate, syncPresentFromWorkforce } from "@/lib/attendance";
import { logActivity } from "@/lib/activity";

const openWhere = { status: { notIn: CLOSED_STATUSES as unknown as never } };

export type TopUpResult = { assigned: number; present: number; detail: string };

/**
 * Tops every present counsellor up to their own daily target from the unassigned pool
 * (highest-priority, longest-waiting leads first, spread round-robin so the good leads are
 * shared fairly). Used by the scheduled morning cron so admins don't hand-assign daily.
 * Only present counsellors receive leads; anyone already at target is left alone.
 */
export async function topUpPresentCounsellors(): Promise<TopUpResult> {
  await syncPresentFromWorkforce();

  const present = await prisma.attendance.findMany({ where: { date: dayDate() }, select: { userId: true } });
  const presentIds = present.map((p) => p.userId);
  if (presentIds.length === 0) return { assigned: 0, present: 0, detail: "no counsellors present" };

  const callers = await prisma.user.findMany({
    where: { id: { in: presentIds }, role: "TELECALLER", active: true },
    select: { id: true, name: true, dailyTarget: true },
  });
  if (callers.length === 0) return { assigned: 0, present: 0, detail: "no present counsellors" };

  const needs = await Promise.all(
    callers.map(async (c) => {
      const open = await prisma.customer.count({ where: { assignedToId: c.id, ...openWhere } });
      return { id: c.id, name: c.name, need: Math.max(0, c.dailyTarget - open) };
    }),
  );
  const totalNeed = needs.reduce((sum, n) => sum + n.need, 0);
  if (totalNeed === 0) return { assigned: 0, present: callers.length, detail: "everyone already at target" };

  const pool = await prisma.customer.findMany({
    where: { assignedToId: null, calls: { none: {} }, ...openWhere },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: totalNeed,
    select: { id: true },
  });

  const byCaller = new Map<string, string[]>(needs.map((n) => [n.id, []]));
  const remaining = new Map(needs.map((n) => [n.id, n.need]));
  let pi = 0;
  while (pi < pool.length) {
    let progressed = false;
    for (const n of needs) {
      if ((remaining.get(n.id) ?? 0) > 0) {
        if (pi >= pool.length) break;
        byCaller.get(n.id)!.push(pool[pi++].id);
        remaining.set(n.id, remaining.get(n.id)! - 1);
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  const entries = [...byCaller.entries()].filter(([, ids]) => ids.length > 0);
  if (entries.length > 0) {
    await prisma.$transaction(
      entries.map(([callerId, ids]) =>
        prisma.customer.updateMany({ where: { id: { in: ids } }, data: { assignedToId: callerId } }),
      ),
    );
  }

  const assigned = entries.reduce((sum, [, ids]) => sum + ids.length, 0);
  const detail =
    entries.map(([id, ids]) => `${needs.find((n) => n.id === id)?.name ?? id}: ${ids.length}`).join(", ") || "none";

  await logActivity({
    action: "AUTO_ASSIGN_SCHEDULED",
    entity: "Customer",
    detail: `${assigned} assigned to ${callers.length} present (${detail})`,
  });

  return { assigned, present: callers.length, detail };
}

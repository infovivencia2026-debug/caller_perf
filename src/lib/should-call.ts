import { prisma } from "@/lib/prisma";
import { SHOULD_CALL_ONLY_STATUSES } from "@/lib/queue";
import { startOfDay } from "@/lib/metrics";

/**
 * Outcomes where nobody was actually spoken to. The lead is still worth a try later the
 * same day — a busy line at 11am is usually free by 4pm — so these go on the
 * "should call" list rather than waiting for tomorrow's queue.
 */
export type ShouldCallEntry = {
  customerId: string;
  name: string;
  phone: string;
  company: string | null;
  city: string | null;
  status: string;
  /** Outcome of the most recent attempt. */
  lastStatus: string;
  lastTriedAt: Date;
  /** How many times this lead has been tried today. */
  attemptsToday: number;
};

/**
 * Leads this counsellor tried today but never reached: no answer, busy, switched off.
 *
 * Built from today's calls rather than from customer status, because status only
 * remembers the latest state and we need "was the *last* attempt a no-connect" — a
 * lead who did not pick up at 10am but was reached at 3pm must drop off the list.
 * Deleted leads (invalid numbers) and closed ones are excluded, since neither should
 * ever be dialled again.
 */
export async function getShouldCallList(callerId: string): Promise<ShouldCallEntry[]> {
  // Next-day only: leads whose current status is a no-connect (no answer / busy) AND whose
  // last attempt was before today, so a lead tried today waits until tomorrow.
  const customers = await prisma.customer.findMany({
    where: {
      assignedToId: callerId,
      status: { in: SHOULD_CALL_ONLY_STATUSES as unknown as never },
      calls: { none: { startedAt: { gte: startOfDay() } } },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      company: true,
      city: true,
      status: true,
      calls: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true, startedAt: true } },
      _count: { select: { calls: true } },
    },
  });

  return customers
    .map((customer) => ({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      company: customer.company,
      city: customer.city,
      status: customer.status,
      lastStatus: customer.calls[0]?.status ?? customer.status,
      lastTriedAt: customer.calls[0]?.startedAt ?? new Date(0),
      attemptsToday: customer._count.calls,
    }))
    // Longest since the last attempt first.
    .sort((a, b) => a.lastTriedAt.getTime() - b.lastTriedAt.getTime());
}

export async function getShouldCallCount(callerId: string) {
  return prisma.customer.count({
    where: {
      assignedToId: callerId,
      status: { in: SHOULD_CALL_ONLY_STATUSES as unknown as never },
      calls: { none: { startedAt: { gte: startOfDay() } } },
    },
  });
}

/**
 * Should-call progress for today, tracked SEPARATELY from the daily target: how many
 * no-connect leads were retried today vs. how many are still waiting, and the percentage.
 * A retry is a call today to a lead that had also been called on an earlier day.
 */
export async function getShouldCallProgress(callerId: string) {
  const pending = await getShouldCallCount(callerId);

  const calledToday = await prisma.call.findMany({
    where: { callerId, startedAt: { gte: startOfDay() }, customerId: { not: null } },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const ids = calledToday.map((r) => r.customerId).filter((v): v is string => Boolean(v));

  let doneToday = 0;
  if (ids.length > 0) {
    doneToday = await prisma.customer.count({
      where: { id: { in: ids }, calls: { some: { startedAt: { lt: startOfDay() } } } },
    });
  }

  const total = pending + doneToday;
  return { pending, doneToday, total, percent: total > 0 ? Math.round((doneToday / total) * 100) : 0 };
}

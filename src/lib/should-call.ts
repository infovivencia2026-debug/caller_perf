import { prisma } from "@/lib/prisma";
import { CLOSED_STATUSES } from "@/lib/queue";
import { startOfDay } from "@/lib/metrics";

/**
 * Outcomes where nobody was actually spoken to. The lead is still worth a try later the
 * same day — a busy line at 11am is usually free by 4pm — so these go on the
 * "should call" list rather than waiting for tomorrow's queue.
 */
export const NO_CONNECT_STATUSES = ["NO_ANSWER", "BUSY", "SWITCHED_OFF"] as const;

const NO_CONNECT = new Set<string>(NO_CONNECT_STATUSES);

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
  const calls = await prisma.call.findMany({
    where: { callerId, startedAt: { gte: startOfDay() }, customerId: { not: null } },
    orderBy: { startedAt: "desc" },
    select: {
      status: true,
      startedAt: true,
      customer: {
        select: { id: true, name: true, phone: true, company: true, city: true, status: true },
      },
    },
  });

  const seen = new Map<string, ShouldCallEntry>();
  for (const call of calls) {
    const customer = call.customer;
    if (!customer) continue;
    if ((CLOSED_STATUSES as readonly string[]).includes(customer.status)) continue;

    // `has`, not a truthiness check: leads that were reached later in the day are
    // recorded with a null sentinel, and testing the value would treat that as
    // "unseen" and let an earlier no-connect put them back on the list.
    if (seen.has(customer.id)) {
      // Calls arrive newest first, so anything after the first is an earlier attempt.
      const existing = seen.get(customer.id);
      if (existing) existing.attemptsToday += 1;
      continue;
    }

    // The first row for this customer is their latest attempt — that is the one that
    // decides whether they still need calling.
    if (!NO_CONNECT.has(call.status)) {
      // Reached later in the day: mark them seen so earlier no-connects don't re-add
      // them, but keep them off the list.
      seen.set(customer.id, null as unknown as ShouldCallEntry);
      continue;
    }

    seen.set(customer.id, {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      company: customer.company,
      city: customer.city,
      status: customer.status,
      lastStatus: call.status,
      lastTriedAt: call.startedAt,
      attemptsToday: 1,
    });
  }

  return [...seen.values()]
    .filter(Boolean)
    // Longest since the last attempt first — the busy line from this morning is a
    // better bet than the one from five minutes ago.
    .sort((a, b) => a.lastTriedAt.getTime() - b.lastTriedAt.getTime());
}

export async function getShouldCallCount(callerId: string) {
  return (await getShouldCallList(callerId)).length;
}

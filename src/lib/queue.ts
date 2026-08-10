import { prisma } from "@/lib/prisma";

/**
 * Customer statuses that take a customer out of the calling queue — and out of every
 * assignment pool with it.
 *
 * Someone who has said no is done: calling them again tomorrow, and every tomorrow
 * after that, wastes the counsellor's day and irritates the person. So NOT_INTERESTED
 * sits here alongside a completed sale (CLOSED) and a number that is not a prospect
 * (INVALID). Leads mid-conversation — callbacks, interested, no answer — are not
 * closed and keep coming round.
 *
 * Nothing here is ever handed out again: the queue, auto-assign, the per-file assign
 * and split, and the counsellor's own search all filter on it.
 */
export const CLOSED_STATUSES = ["NOT_INTERESTED", "CLOSED", "INVALID"] as const;

/** Outcomes available through Should Call, but excluded from the normal daily queue. */
export const SHOULD_CALL_ONLY_STATUSES = ["NO_ANSWER", "BUSY"] as const;

const QUEUE_EXCLUDED_STATUSES = [...CLOSED_STATUSES, ...SHOULD_CALL_ONLY_STATUSES] as const;

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/**
 * Picks the next customer to call: assigned to this caller, still open, and not
 * skipped this session. Ordered by follow-up due first, then priority, then the
 * least recently contacted.
 */
export async function getNextCustomer(
  callerId: string,
  skipIds: string[] = [],
  { targetReached = false }: { targetReached?: boolean } = {},
) {
  const now = new Date();
  const candidates = await prisma.customer.findMany({
    where: {
      assignedToId: callerId,
      status: { notIn: QUEUE_EXCLUDED_STATUSES as unknown as never },
      ...(skipIds.length > 0 ? { id: { notIn: skipIds } } : {}),
      // Once the daily target is hit, only scheduled work that is DUE now keeps coming —
      // no fresh leads. Otherwise: a follow-up is due now, OR the customer isn't scheduled
      // for later and hasn't been called today.
      OR: targetReached
        ? [{ followUps: { some: { status: "PENDING", dueAt: { lte: now } } } }]
        : [
            { followUps: { some: { status: "PENDING", dueAt: { lte: now } } } },
            {
              // A fresh lead is one that has NEVER been called — an already-called number
              // is never served again as a new call (only scheduled follow-ups/callbacks
              // and Should Call bring a contacted number back).
              AND: [{ followUps: { none: { status: "PENDING" } } }, { calls: { none: {} } }],
            },
          ],
    },
    include: {
      calls: { orderBy: { startedAt: "desc" }, take: 3, include: { caller: { select: { name: true } } } },
      followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1 },
      // The calling screen shows the latest three but must be able to say how many
      // there really are — counting `calls.length` there would only ever report 3.
      _count: { select: { calls: true } },
    },
    take: 200,
  });

  // Daily assigned queue is empty → fall back to Should Call: no-connect leads
  // (no answer / busy) whose last attempt was BEFORE today, so they only come back the
  // NEXT day, appended after the day's assigned calls are done. Should Call is fresh work,
  // so it stops once the target is reached — only due follow-ups/callbacks continue.
  if (candidates.length === 0 && !targetReached) {
    const shouldCall = await prisma.customer.findMany({
      where: {
        assignedToId: callerId,
        status: { in: SHOULD_CALL_ONLY_STATUSES as unknown as never },
        ...(skipIds.length > 0 ? { id: { notIn: skipIds } } : {}),
        calls: { none: { startedAt: { gte: startOfToday(now) } } },
      },
      include: {
        calls: { orderBy: { startedAt: "desc" }, take: 3, include: { caller: { select: { name: true } } } },
        followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1 },
        _count: { select: { calls: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 1,
    });
    return shouldCall[0] ?? null;
  }

  // Nothing left to serve (e.g. target reached and no due follow-ups/callbacks).
  if (candidates.length === 0) return null;

  const nowMs = now.getTime();
  const scored = candidates.map((customer) => {
    const dueAt = customer.followUps[0]?.dueAt.getTime();
    return {
      customer,
      dueSoon: dueAt !== undefined && dueAt <= nowMs ? 0 : 1,
      dueAt: dueAt ?? Number.MAX_SAFE_INTEGER,
      priority: PRIORITY_ORDER[customer.priority],
      lastCalledAt: customer.calls[0]?.startedAt.getTime() ?? 0,
    };
  });

  scored.sort(
    (a, b) =>
      a.dueSoon - b.dueSoon ||
      a.dueAt - b.dueAt ||
      a.priority - b.priority ||
      a.lastCalledAt - b.lastCalledAt,
  );

  return scored[0].customer;
}

export async function getQueueCount(callerId: string) {
  return prisma.customer.count({
    where: { assignedToId: callerId, status: { notIn: QUEUE_EXCLUDED_STATUSES as unknown as never } },
  });
}

/**
 * Fetches one specific customer to put on the calling screen — used when a caller
 * clicks "Call" on a follow-up. Scoped to the caller's own open customers, and shaped
 * exactly like getNextCustomer so the page can use either interchangeably.
 */
export async function getAssignedCustomer(callerId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: {
      id: customerId,
      assignedToId: callerId,
      status: { notIn: CLOSED_STATUSES as unknown as never },
    },
    include: {
      calls: { orderBy: { startedAt: "desc" }, take: 3, include: { caller: { select: { name: true } } } },
      followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1 },
      // The calling screen shows the latest three but must be able to say how many
      // there really are — counting `calls.length` there would only ever report 3.
      _count: { select: { calls: true } },
    },
  });
}

/**
 * Finds the caller's own open customers by name or phone number. Digits in the query
 * are matched against the phone (so "98765" or "+91 98765" both work) and the raw text
 * against the name, case-insensitively.
 */
export async function searchAssignedCustomers(callerId: string, query: string, take = 10) {
  const text = query.trim();
  if (!text) return [];
  // Phones are stored normalised to their last 10 digits (see normalizePhone), so a
  // pasted "+91 90000 00002" has to be reduced the same way or it matches nothing.
  const rawDigits = text.replace(/\D/g, "");
  const digits = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;

  return prisma.customer.findMany({
    where: {
      assignedToId: callerId,
      status: { notIn: CLOSED_STATUSES as unknown as never },
      OR: [
        { name: { contains: text, mode: "insensitive" as const } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ],
    },
    orderBy: { name: "asc" },
    take,
    select: { id: true, name: true, phone: true, company: true, city: true, status: true },
  });
}

function startOfToday(reference: Date) {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  return d;
}

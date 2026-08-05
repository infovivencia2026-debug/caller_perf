import { prisma } from "@/lib/prisma";

/** Customer statuses that take a customer out of the calling queue. */
export const CLOSED_STATUSES = ["NOT_INTERESTED", "CLOSED", "INVALID"] as const;

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/**
 * Picks the next customer to call: assigned to this caller, still open, and not
 * skipped this session. Ordered by follow-up due first, then priority, then the
 * least recently contacted.
 */
export async function getNextCustomer(callerId: string, skipIds: string[] = []) {
  const now = new Date();
  const candidates = await prisma.customer.findMany({
    where: {
      assignedToId: callerId,
      status: { notIn: CLOSED_STATUSES as unknown as never },
      ...(skipIds.length > 0 ? { id: { notIn: skipIds } } : {}),
      // Either a follow-up is due now, or the customer is not scheduled for later
      // and has not been called today.
      OR: [
        { followUps: { some: { status: "PENDING", dueAt: { lte: now } } } },
        {
          AND: [
            { followUps: { none: { status: "PENDING" } } },
            { calls: { none: { startedAt: { gte: startOfToday(now) } } } },
          ],
        },
      ],
    },
    include: {
      calls: { orderBy: { startedAt: "desc" }, take: 3, include: { caller: { select: { name: true } } } },
      followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1 },
    },
    take: 200,
  });

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
    where: { assignedToId: callerId, status: { notIn: CLOSED_STATUSES as unknown as never } },
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
  const digits = text.replace(/\D/g, "");

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

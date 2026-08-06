import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { CONVERTED_STATUSES, SUCCESS_STATUSES } from "@/lib/labels";

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Week starts Monday. */
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function startOfMonth(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export type OutcomeBreakdown = { status: string; count: number };

export type CallerStats = {
  /** Every outcome and how often it happened, for the same period. */
  outcomes: OutcomeBreakdown[];
  /** Distinct leads touched, which is not the same as calls made. */
  customersCalled: number;
  /** Calls that reached nobody: no answer, busy, switched off. */
  noConnectCalls: number;
  connectRate: number;
  /** Follow-ups falling due in the period, and how many were kept. */
  followUpsDue: number;
  followUpsKept: number;
  /** Distinct days with at least one call — the divisor for a daily average. */
  activeDays: number;
  callsPerActiveDay: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  convertedLeads: number;
  interestedLeads: number;
  conversionRate: number;
  avgDuration: number;
  totalDuration: number;
  callsPerHour: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  followUpCompletionRate: number;
};

/** Aggregates call and follow-up metrics. Omit callerId for org-wide numbers. */
export async function getStats(options: {
  callerId?: string;
  from?: Date;
  to?: Date;
}): Promise<CallerStats> {
  const callWhere = {
    ...(options.callerId ? { callerId: options.callerId } : {}),
    ...(options.from || options.to
      ? { startedAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lt: options.to } : {}) } }
      : {}),
  };

  // Follow-ups scheduled *within the period*, so "kept" can be measured against the
  // same window as the calls rather than against all time.
  const followUpWhere = {
    ...(options.callerId ? { callerId: options.callerId } : {}),
    ...(options.from || options.to
      ? { dueAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lt: options.to } : {}) } }
      : {}),
  };

  const [totals, byStatus, followUps, periodFollowUps, distinctCustomers, days] = await Promise.all([
    prisma.call.aggregate({ where: callWhere, _count: true, _sum: { duration: true } }),
    prisma.call.groupBy({ by: ["status"], where: callWhere, _count: { _all: true } }),
    prisma.followUp.groupBy({
      by: ["status"],
      where: options.callerId ? { callerId: options.callerId } : {},
      _count: { _all: true },
    }),
    prisma.followUp.groupBy({ by: ["status"], where: followUpWhere, _count: { _all: true } }),
    prisma.call.findMany({ where: callWhere, distinct: ["customerPhone"], select: { customerPhone: true } }),
    prisma.$queryRaw<{ days: bigint }[]>`
      SELECT count(DISTINCT date_trunc('day', "startedAt")) AS days
      FROM "Call"
      WHERE ${options.callerId ? Prisma.sql`"callerId" = ${options.callerId}` : Prisma.sql`TRUE`}
        AND ${options.from ? Prisma.sql`"startedAt" >= ${options.from}` : Prisma.sql`TRUE`}
        AND ${options.to ? Prisma.sql`"startedAt" < ${options.to}` : Prisma.sql`TRUE`}
    `,
  ]);

  const countFor = (statuses: string[]) =>
    byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);

  const totalCalls = totals._count;
  const totalDuration = totals._sum.duration ?? 0;
  const successfulCalls = countFor(SUCCESS_STATUSES);
  const convertedLeads = countFor(CONVERTED_STATUSES);
  const interestedLeads = countFor(["INTERESTED"]);

  const followUpCount = (status: string) =>
    followUps.find((row) => row.status === status)?._count._all ?? 0;
  const pendingFollowUps = followUpCount("PENDING");
  const completedFollowUps = followUpCount("COMPLETED");
  const missedFollowUps = followUpCount("MISSED");

  const noConnectCalls = countFor(["NO_ANSWER", "BUSY", "SWITCHED_OFF"]);
  const activeDays = Number(days[0]?.days ?? 0);
  const periodCount = (status: string) =>
    periodFollowUps.find((row) => row.status === status)?._count._all ?? 0;
  const followUpsDue = periodFollowUps.reduce((sum, row) => sum + row._count._all, 0);

  return {
    outcomes: byStatus
      .map((row) => ({ status: row.status as string, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    customersCalled: distinctCustomers.length,
    noConnectCalls,
    connectRate: percent(totalCalls - noConnectCalls, totalCalls),
    followUpsDue,
    followUpsKept: periodCount("COMPLETED"),
    activeDays,
    callsPerActiveDay: activeDays > 0 ? Math.round((totalCalls / activeDays) * 10) / 10 : 0,
    totalCalls,
    successfulCalls,
    failedCalls: totalCalls - successfulCalls,
    convertedLeads,
    interestedLeads,
    conversionRate: percent(convertedLeads, totalCalls),
    avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
    totalDuration,
    callsPerHour: totalDuration > 0 ? Math.round((totalCalls / (totalDuration / 3600)) * 10) / 10 : 0,
    pendingFollowUps,
    completedFollowUps,
    followUpCompletionRate: percent(completedFollowUps, completedFollowUps + pendingFollowUps + missedFollowUps),
  };
}

/** True when a follow-up due date has passed. Evaluated per request on the server. */
export function isOverdue(dueAt: Date) {
  return dueAt.getTime() <= new Date().getTime();
}

import { prisma } from "@/lib/prisma";
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

export type CallerStats = {
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

  const [totals, byStatus, followUps] = await Promise.all([
    prisma.call.aggregate({ where: callWhere, _count: true, _sum: { duration: true } }),
    prisma.call.groupBy({ by: ["status"], where: callWhere, _count: { _all: true } }),
    prisma.followUp.groupBy({
      by: ["status"],
      where: options.callerId ? { callerId: options.callerId } : {},
      _count: { _all: true },
    }),
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

  return {
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

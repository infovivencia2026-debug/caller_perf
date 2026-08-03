import { prisma } from "@/lib/prisma";
import { istDayUTC } from "@/lib/datetime";
import { fetchPresentEmailsToday } from "@/lib/workforce";

/** The India-time calendar day as a UTC-midnight Date (matches the Postgres DATE column). */
export function dayDate(reference = new Date()) {
  return istDayUTC(reference);
}

/** Records the telecaller as present on the given day (idempotent). */
export async function markPresent(userId: string, when = new Date()) {
  const date = dayDate(when);
  await prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date },
  });
}

/** Removes today's present mark for the telecaller (idempotent). */
export async function markAbsent(userId: string, when = new Date()) {
  const date = dayDate(when);
  await prisma.attendance.deleteMany({ where: { userId, date } });
}

/**
 * Marks present every active telecaller who has punched in on workforce-os today, matched
 * by email. Idempotent and best-effort — so telecallers who already clocked in there don't
 * have to press "Mark present" again here. Safe to call on page loads.
 */
export async function syncPresentFromWorkforce() {
  const emails = await fetchPresentEmailsToday();
  if (emails.length === 0) return;

  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER", active: true, email: { in: emails } },
    select: { id: true },
  });
  if (callers.length === 0) return;

  const date = dayDate();
  await Promise.all(
    callers.map((caller) =>
      prisma.attendance.upsert({
        where: { userId_date: { userId: caller.id, date } },
        update: {},
        create: { userId: caller.id, date },
      }),
    ),
  );
}

/** Whether the telecaller is already marked present today. */
export async function isPresentToday(userId: string) {
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: dayDate() } },
  });
  return Boolean(row);
}

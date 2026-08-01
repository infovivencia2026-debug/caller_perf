import { prisma } from "@/lib/prisma";
import { istDayUTC } from "@/lib/datetime";

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

/** Whether the telecaller is already marked present today. */
export async function isPresentToday(userId: string) {
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: dayDate() } },
  });
  return Boolean(row);
}

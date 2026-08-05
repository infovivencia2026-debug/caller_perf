"use server";

import { revalidatePath } from "next/cache";
import { requireCaller } from "@/lib/auth";
import { markAbsent, markPresent } from "@/lib/attendance";
import { logActivity } from "@/lib/activity";

/** Counsellor marks themselves present for today. */
export async function checkIn() {
  const session = await requireCaller();
  await markPresent(session.userId);
  await logActivity({
    userId: session.userId,
    action: "CHECKED_IN",
    entity: "User",
    entityId: session.userId,
    detail: `${session.name} marked present`,
  });
  revalidatePath("/caller");
}

/** Counsellor marks themselves absent for today (undo of an accidental/earlier check-in). */
export async function checkOut() {
  const session = await requireCaller();
  await markAbsent(session.userId);
  await logActivity({
    userId: session.userId,
    action: "CHECKED_OUT",
    entity: "User",
    entityId: session.userId,
    detail: `${session.name} marked absent`,
  });
  revalidatePath("/caller");
}

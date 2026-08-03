"use server";

import { revalidatePath } from "next/cache";
import { requireCaller } from "@/lib/auth";
import { isPresentToday, markAbsent, markPresent } from "@/lib/attendance";
import { logActivity } from "@/lib/activity";

/** Telecaller marks themselves present for today. */
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

/**
 * Toggles the telecaller's present/absent state for today, so the one button both marks
 * present and lets them undo it. Admin's roster and auto-assign follow this immediately.
 */
export async function togglePresent() {
  const session = await requireCaller();
  const present = await isPresentToday(session.userId);
  if (present) {
    await markAbsent(session.userId);
  } else {
    await markPresent(session.userId);
  }
  await logActivity({
    userId: session.userId,
    action: present ? "CHECKED_OUT" : "CHECKED_IN",
    entity: "User",
    entityId: session.userId,
    detail: `${session.name} marked ${present ? "absent" : "present"}`,
  });
  revalidatePath("/caller");
}

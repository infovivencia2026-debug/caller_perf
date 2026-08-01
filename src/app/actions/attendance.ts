"use server";

import { revalidatePath } from "next/cache";
import { requireCaller } from "@/lib/auth";
import { markPresent } from "@/lib/attendance";
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

"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function settingsHref(ok?: string, error?: string) {
  const params = new URLSearchParams();
  if (ok) params.set("ok", ok);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/admin/settings?${query}` : "/admin/settings";
}

const ownSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "The new passwords do not match",
    path: ["confirmPassword"],
  });

/** The signed-in admin changes their own password — current password required. */
export async function changeOwnPassword(formData: FormData) {
  const session = await requireAdmin();

  const parsed = ownSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) redirect(settingsHref(undefined, parsed.error.issues[0].message));

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect(settingsHref(undefined, "Account not found"));
  // Verify the current password so a borrowed/open session can't silently reset it.
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    redirect(settingsHref(undefined, "Your current password is incorrect"));
  }
  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    redirect(settingsHref(undefined, "The new password must be different from the current one"));
  }

  // Bump the token version to invalidate every existing session, then re-issue this
  // admin a fresh one so they stay signed in with the new password.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), tokenVersion: { increment: 1 } },
    select: { id: true, name: true, role: true, tokenVersion: true },
  });
  await createSession({ userId: updated.id, name: updated.name, role: updated.role }, updated.tokenVersion);
  await logActivity({
    userId: session.userId,
    action: "PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
    detail: `${user.name} changed their own password`,
  });
  redirect(settingsHref("Your password has been updated"));
}

const resetSchema = z.object({
  callerId: z.string().min(1, "Choose a telecaller"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/** Admin sets a telecaller's password directly. Scoped to telecallers only. */
export async function resetCallerPassword(formData: FormData) {
  const session = await requireAdmin();

  const parsed = resetSchema.safeParse({
    callerId: String(formData.get("callerId") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
  });
  if (!parsed.success) redirect(settingsHref(undefined, parsed.error.issues[0].message));

  const caller = await prisma.user.findUnique({ where: { id: parsed.data.callerId } });
  // Only telecallers — an admin cannot reset another admin's password here.
  if (!caller || caller.role !== "TELECALLER") {
    redirect(settingsHref(undefined, "Telecaller not found"));
  }

  // Bump the token version so the telecaller's current sessions (and the old password)
  // stop working — they must sign in again with the new password.
  await prisma.user.update({
    where: { id: caller.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), tokenVersion: { increment: 1 } },
  });
  await logActivity({
    userId: session.userId,
    action: "PASSWORD_RESET",
    entity: "User",
    entityId: caller.id,
    detail: `${caller.name}'s password was reset by ${session.name}`,
  });
  redirect(settingsHref(`${caller.name}'s password has been reset — share it with them`));
}

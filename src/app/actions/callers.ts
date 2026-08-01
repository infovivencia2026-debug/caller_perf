"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { planEqualAssignments, type CallerQueue } from "@/lib/assign";
import { CLOSED_STATUSES } from "@/lib/queue";

/** A sane ceiling — a typo like 5000 would swallow the whole customer list. */
const MAX_DAILY_TARGET = 500;

/** New telecallers get this password when the admin leaves the field blank. */
const DEFAULT_CALLER_PASSWORD = "password123";

const targetSchema = z.object({
  callerId: z.string().min(1),
  dailyTarget: z.coerce.number().int().min(0).max(MAX_DAILY_TARGET),
});

function callersHref(message?: string, error?: string) {
  const params = new URLSearchParams();
  if (message) params.set("ok", message);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/admin/callers?${query}` : "/admin/callers";
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Enter a valid email"),
  // Blank means "use the default password"; a typed value must be at least 8 chars.
  password: z.union([z.string().min(8, "Password must be at least 8 characters"), z.literal("")]),
  dailyTarget: z.coerce.number().int().min(0).max(MAX_DAILY_TARGET),
});

export async function createCaller(formData: FormData) {
  const session = await requireAdmin();

  const parsed = createSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    dailyTarget: String(formData.get("dailyTarget") ?? "50"),
  });
  if (!parsed.success) {
    redirect(callersHref(undefined, parsed.error.issues[0].message));
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    redirect(callersHref(undefined, `${parsed.data.email} is already registered`));
  }

  const password = parsed.data.password || DEFAULT_CALLER_PASSWORD;
  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "TELECALLER",
      dailyTarget: parsed.data.dailyTarget,
    },
  });
  await logActivity({
    userId: session.userId,
    action: "CALLER_CREATED",
    entity: "User",
    entityId: created.id,
    detail: `${created.name} (${created.email}) — daily target ${created.dailyTarget}`,
  });

  revalidatePath("/admin/callers");
  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  redirect(callersHref(`${created.name} can now sign in with ${created.email}`));
}

export async function updateDailyTarget(formData: FormData) {
  const session = await requireAdmin();

  const parsed = targetSchema.safeParse({
    callerId: String(formData.get("callerId") ?? ""),
    dailyTarget: String(formData.get("dailyTarget") ?? ""),
  });
  if (!parsed.success) {
    redirect(callersHref(undefined, `Daily target must be a whole number between 0 and ${MAX_DAILY_TARGET}`));
  }

  const caller = await prisma.user.findUnique({ where: { id: parsed.data.callerId } });
  if (!caller || caller.role !== "TELECALLER") {
    redirect(callersHref(undefined, "Telecaller not found"));
  }

  await prisma.user.update({
    where: { id: caller.id },
    data: { dailyTarget: parsed.data.dailyTarget },
  });
  await logActivity({
    userId: session.userId,
    action: "TARGET_UPDATED",
    entity: "User",
    entityId: caller.id,
    detail: `${caller.name} — daily target ${caller.dailyTarget} → ${parsed.data.dailyTarget}`,
  });

  revalidatePath("/admin/callers");
  revalidatePath("/admin");
  redirect(callersHref(`${caller.name}'s daily target is now ${parsed.data.dailyTarget}`));
}

const autoAssignSchema = z.object({
  target: z.coerce.number().int().min(1).max(MAX_DAILY_TARGET),
});

/**
 * Distributes unassigned, still-open customers equally across active telecallers, up to
 * the chosen target each. The target also becomes every active telecaller's daily
 * target. Highest-priority and longest-waiting customers go out first; anyone already
 * holding open customers is topped up toward the target rather than reset.
 */
export async function autoAssign(formData: FormData) {
  const session = await requireAdmin();

  const parsed = autoAssignSchema.safeParse({ target: String(formData.get("target") ?? "") });
  if (!parsed.success) {
    redirect(callersHref(undefined, `Enter a target between 1 and ${MAX_DAILY_TARGET}`));
  }
  const target = parsed.data.target;

  const openWhere = { status: { notIn: CLOSED_STATUSES as unknown as never } };

  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  if (callers.length === 0) {
    redirect(callersHref(undefined, "No active telecallers to assign to"));
  }

  // The chosen target becomes everyone's daily target.
  await prisma.user.updateMany({
    where: { role: "TELECALLER", active: true },
    data: { dailyTarget: target },
  });

  const queues: CallerQueue[] = await Promise.all(
    callers.map(async (caller) => ({
      ...caller,
      queued: await prisma.customer.count({ where: { assignedToId: caller.id, ...openWhere } }),
    })),
  );

  const pool = await prisma.customer.findMany({
    where: { assignedToId: null, ...openWhere },
    // HIGH before MEDIUM before LOW is alphabetical in reverse; then oldest first.
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const plan = planEqualAssignments(
    queues,
    pool.map((customer) => customer.id),
    target,
  );

  if (plan.assigned > 0) {
    await prisma.$transaction(
      [...plan.byCaller.entries()].map(([callerId, customerIds]) =>
        prisma.customer.updateMany({
          where: { id: { in: customerIds } },
          data: { assignedToId: callerId },
        }),
      ),
    );
  }

  const summary =
    plan.assigned > 0
      ? [...plan.byCaller.entries()]
          .map(([callerId, ids]) => `${callers.find((c) => c.id === callerId)?.name ?? callerId}: ${ids.length}`)
          .join(", ")
      : "none — every telecaller was already at the target";

  await logActivity({
    userId: session.userId,
    action: "AUTO_ASSIGNED",
    entity: "Customer",
    detail: `target ${target}; ${plan.assigned} assigned (${summary})`,
  });

  revalidatePath("/admin/callers");
  revalidatePath("/admin/customers");
  revalidatePath("/admin");

  const leftOver = plan.leftOver > 0 ? ` ${plan.leftOver} left unassigned (targets full).` : "";
  redirect(
    callersHref(`Daily target set to ${target}. Assigned ${plan.assigned} customer(s) equally — ${summary}.${leftOver}`),
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { planBalancedAssignments, type CallerQueue } from "@/lib/assign";
import { dayDate, syncPresentFromWorkforce } from "@/lib/attendance";
import { CLOSED_STATUSES, SHOULD_CALL_ONLY_STATUSES } from "@/lib/queue";

/** A sane ceiling — a typo like 5000 would swallow the whole customer list. */
const MAX_DAILY_TARGET = 500;

/** New counsellors get this password when the admin leaves the field blank. */
const DEFAULT_CALLER_PASSWORD = "onrol@ai";

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

/**
 * Removes a counsellor by DEACTIVATING them rather than hard-deleting: they can no
 * longer sign in and drop out of auto-assign, and their customers are unassigned back
 * into the pool — but their call history, follow-ups and attendance are kept so reports
 * and the calendar stay accurate. (A hard delete would cascade and erase all of that.)
 */
export async function deleteCaller(formData: FormData) {
  const session = await requireAdmin();
  const callerId = String(formData.get("callerId") ?? "");

  const caller = await prisma.user.findUnique({ where: { id: callerId } });
  if (!caller || caller.role !== "TELECALLER") {
    redirect(callersHref(undefined, "Counsellor not found"));
  }

  // Free up their customers so those leads return to the pool for reassignment.
  await prisma.customer.updateMany({ where: { assignedToId: caller.id }, data: { assignedToId: null } });
  // Deactivate + invalidate sessions; keep the row (and its calls) for history.
  await prisma.user.update({
    where: { id: caller.id },
    data: { active: false, tokenVersion: { increment: 1 } },
  });

  await logActivity({
    userId: session.userId,
    action: "CALLER_DEACTIVATED",
    entity: "User",
    entityId: caller.id,
    detail: `${caller.name} (${caller.email}) removed; customers unassigned, call history kept`,
  });

  revalidatePath("/admin/callers");
  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  // No confirmation banner — the counsellor simply disappears from the roster.
  redirect(callersHref());
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
    redirect(callersHref(undefined, "Counsellor not found"));
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

/**
 * Returns a counsellor's UNCALLED leads to the pool without touching the counsellor.
 * Only leads nobody has started on are pulled back — anything already called (or with a
 * pending follow-up) stays put, so no conversation or callback is stranded.
 */
export async function unassignCaller(formData: FormData) {
  const session = await requireAdmin();
  const callerId = String(formData.get("callerId") ?? "");
  // Blank / 0 means "all untouched leads"; a positive number caps how many are returned.
  const requested = Math.max(0, Math.floor(Number(formData.get("count") ?? 0) || 0));

  const caller = await prisma.user.findUnique({ where: { id: callerId } });
  if (!caller || caller.role !== "TELECALLER") {
    redirect(callersHref(undefined, "Counsellor not found"));
  }

  // Release assigned leads with no future action on them: no pending follow-up/callback
  // AND not a no-answer/busy (those belong to Should Call and stay with the counsellor
  // for the next day). This returns fresh never-called leads and dead-end outcomes
  // (out of service, disconnected, …) to the pool, and keeps all scheduled work.
  const untouchedWhere = {
    assignedToId: caller.id,
    status: { notIn: SHOULD_CALL_ONLY_STATUSES as unknown as never },
    followUps: { none: { status: "PENDING" as const } },
  };

  let count: number;
  if (requested > 0) {
    // Take exactly the requested number, oldest first.
    const picked = await prisma.customer.findMany({
      where: untouchedWhere,
      orderBy: { createdAt: "asc" },
      take: requested,
      select: { id: true },
    });
    const result = await prisma.customer.updateMany({
      where: { id: { in: picked.map((c) => c.id) } },
      data: { assignedToId: null },
    });
    count = result.count;
  } else {
    const result = await prisma.customer.updateMany({ where: untouchedWhere, data: { assignedToId: null } });
    count = result.count;
  }

  await logActivity({
    userId: session.userId,
    action: "CALLER_UNASSIGNED",
    entity: "User",
    entityId: caller.id,
    detail: `${count} lead(s) without a pending follow-up returned to the pool from ${caller.name}`,
  });

  revalidatePath("/admin/callers");
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
  redirect(
    callersHref(
      `${count} lead(s) returned to the pool from ${caller.name} (leads with a pending follow-up were kept)`,
    ),
  );
}

const autoAssignSchema = z.object({
  target: z.coerce.number().int().min(1).max(MAX_DAILY_TARGET),
});

/**
 * Distributes unassigned, still-open customers equally across active counsellors, up to
 * the chosen target each. The target also becomes every active counsellor's daily
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

  const activeCallers = await prisma.user.findMany({
    where: { role: "TELECALLER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  if (activeCallers.length === 0) {
    redirect(callersHref(undefined, "No active counsellors to assign to"));
  }

  // Only counsellors marked present today receive new leads — pull in workforce-os
  // punch-ins first so clocking in there counts as present here.
  await syncPresentFromWorkforce();
  const presentRows = await prisma.attendance.findMany({
    where: { date: dayDate(), userId: { in: activeCallers.map((c) => c.id) } },
    select: { userId: true },
  });
  const presentIds = new Set(presentRows.map((r) => r.userId));
  const callers = activeCallers.filter((c) => presentIds.has(c.id));
  if (callers.length === 0) {
    redirect(callersHref(undefined, "No counsellors are marked present today — they must click “Mark present” first"));
  }

  // The chosen target becomes the daily target for the present counsellors.
  await prisma.user.updateMany({
    where: { id: { in: callers.map((c) => c.id) } },
    data: { dailyTarget: target },
  });

  // Balance by calls made in the last 7 days, so heavier callers get fewer new leads.
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const queues: CallerQueue[] = await Promise.all(
    callers.map(async (caller) => ({
      ...caller,
      queued: await prisma.customer.count({ where: { assignedToId: caller.id, ...openWhere } }),
      recentCalls: await prisma.call.count({ where: { callerId: caller.id, startedAt: { gte: since } } }),
    })),
  );

  const pool = await prisma.customer.findMany({
    where: { assignedToId: null, calls: { none: {} }, ...openWhere },
    // HIGH before MEDIUM before LOW is alphabetical in reverse; then oldest first.
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const plan = planBalancedAssignments(
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
      : "none — every counsellor was already at the target";

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

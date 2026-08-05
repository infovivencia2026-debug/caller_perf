"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { CLOSED_STATUSES } from "@/lib/queue";

/** Only open (still-callable) leads are handed out; closed ones stay put. */
const openWhere = { status: { notIn: CLOSED_STATUSES as unknown as never } };

function customersHref(message?: string, error?: string) {
  const params = new URLSearchParams();
  if (message) params.set("ok", message);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}

function revalidate() {
  revalidatePath("/admin/customers");
  revalidatePath("/admin/callers");
  revalidatePath("/admin");
}

/**
 * Assigns the hand-picked customers (checkboxes on the list) to one counsellor — or
 * back to the unassigned pool when no counsellor is chosen. Once assigned, each customer
 * shows up in that counsellor's calling queue automatically.
 */
export async function assignSelected(formData: FormData) {
  const session = await requireAdmin();
  const ids = formData.getAll("customerIds").map(String).filter(Boolean);
  const callerId = String(formData.get("callerId") ?? "");

  if (ids.length === 0) {
    redirect(customersHref(undefined, "Tick at least one customer to assign"));
  }

  let callerName = "the unassigned pool";
  if (callerId) {
    const caller = await prisma.user.findUnique({
      where: { id: callerId },
      select: { role: true, name: true },
    });
    if (!caller || caller.role !== "TELECALLER") {
      redirect(customersHref(undefined, "Pick a valid counsellor"));
    }
    callerName = caller.name;
  }

  await prisma.customer.updateMany({
    where: { id: { in: ids } },
    data: { assignedToId: callerId || null },
  });

  await logActivity({
    userId: session.userId,
    action: "CUSTOMERS_ASSIGNED",
    entity: "Customer",
    detail: `${ids.length} customer(s) → ${callerName}`,
  });

  revalidate();
  redirect(customersHref(`Assigned ${ids.length} customer(s) to ${callerName}.`));
}

/**
 * Hands a chosen number of currently-unassigned open leads to one counsellor (highest
 * priority and longest-waiting first) and makes that number their daily target. A manual
 * alternative to auto-assign when you want to load one specific counsellor.
 */
export async function assignCountToCaller(formData: FormData) {
  const session = await requireAdmin();
  const callerId = String(formData.get("callerId") ?? "");
  const count = Math.max(0, Math.min(500, Number(formData.get("count") ?? 0) || 0));

  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { role: true, name: true },
  });
  if (!caller || caller.role !== "TELECALLER") {
    redirect(customersHref(undefined, "Pick a valid counsellor"));
  }
  if (count < 1) {
    redirect(customersHref(undefined, "Enter how many customers to assign (1–500)"));
  }

  const pool = await prisma.customer.findMany({
    where: { assignedToId: null, ...openWhere },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: count,
    select: { id: true },
  });

  if (pool.length > 0) {
    await prisma.customer.updateMany({
      where: { id: { in: pool.map((c) => c.id) } },
      data: { assignedToId: callerId },
    });
  }
  // The batch becomes this counsellor's daily target.
  await prisma.user.update({ where: { id: callerId }, data: { dailyTarget: count } });

  await logActivity({
    userId: session.userId,
    action: "CUSTOMERS_ASSIGNED",
    entity: "Customer",
    detail: `${pool.length} unassigned → ${caller.name} (daily target ${count})`,
  });

  revalidate();
  const short = pool.length < count ? ` Only ${pool.length} unassigned lead(s) were available.` : "";
  redirect(
    customersHref(`Assigned ${pool.length} customer(s) to ${caller.name}; daily target set to ${count}.${short}`),
  );
}

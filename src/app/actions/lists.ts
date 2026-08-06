"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { CLOSED_STATUSES } from "@/lib/queue";

function listsHref(message?: string, error?: string) {
  const params = new URLSearchParams();
  if (message) params.set("message", message);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/admin/lists?${query}` : "/admin/lists";
}

/**
 * Hands a slice of one uploaded file to one counsellor. This is the point of lists:
 * assignment draws from the folder the admin picked, so "give Geetha 50 from the
 * August walk-ins" is a single action rather than a filter-and-hope.
 *
 * Only unassigned, still-open leads are taken, oldest first, so repeated runs walk
 * through the file rather than reshuffling it.
 */
export async function assignFromList(formData: FormData) {
  const session = await requireAdmin();
  const listId = String(formData.get("listId") ?? "");
  const callerId = String(formData.get("callerId") ?? "");
  const count = Math.max(0, Math.min(2000, Number(formData.get("count") ?? 0) || 0));

  const [list, caller] = await Promise.all([
    prisma.importList.findUnique({ where: { id: listId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: callerId }, select: { id: true, name: true, role: true, active: true } }),
  ]);

  if (!list) redirect(listsHref(undefined, "That list no longer exists"));
  if (!caller || caller.role !== "TELECALLER") redirect(listsHref(undefined, "Pick a counsellor"));
  if (!caller.active) redirect(listsHref(undefined, `${caller.name} is inactive`));
  if (count < 1) redirect(listsHref(undefined, "Enter how many leads to assign"));

  const pool = await prisma.customer.findMany({
    where: {
      listId: list.id,
      assignedToId: null,
      status: { notIn: CLOSED_STATUSES as unknown as never },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: count,
    select: { id: true },
  });

  if (pool.length === 0) {
    redirect(listsHref(undefined, `No unassigned leads left in ${list.name}`));
  }

  await prisma.customer.updateMany({
    where: { id: { in: pool.map((c) => c.id) } },
    data: { assignedToId: caller.id },
  });

  await logActivity({
    userId: session.userId,
    action: "LIST_ASSIGNED",
    entity: "ImportList",
    entityId: list.id,
    detail: `${pool.length} from ${list.name} → ${caller.name}`,
  });

  revalidatePath("/admin/lists");
  revalidatePath("/admin/customers");
  redirect(listsHref(`${pool.length} lead${pool.length === 1 ? "" : "s"} from ${list.name} assigned to ${caller.name}`));
}

/** Takes every unassigned lead in a list back off whoever holds them. */
export async function unassignList(formData: FormData) {
  const session = await requireAdmin();
  const listId = String(formData.get("listId") ?? "");

  const list = await prisma.importList.findUnique({ where: { id: listId }, select: { id: true, name: true } });
  if (!list) redirect(listsHref(undefined, "That list no longer exists"));

  // Only leads nobody has started on — pulling a lead back mid-conversation would
  // strand the counsellor's follow-ups.
  const { count } = await prisma.customer.updateMany({
    where: { listId: list.id, status: "NEW", calls: { none: {} } },
    data: { assignedToId: null },
  });

  await logActivity({
    userId: session.userId,
    action: "LIST_UNASSIGNED",
    entity: "ImportList",
    entityId: list.id,
    detail: `${count} untouched lead(s) from ${list.name} returned to the pool`,
  });

  revalidatePath("/admin/lists");
  revalidatePath("/admin/customers");
  redirect(listsHref(`${count} untouched lead${count === 1 ? "" : "s"} returned to the pool`));
}

/** Renames a list or edits its note — an uploaded filename is rarely descriptive. */
export async function updateList(formData: FormData) {
  await requireAdmin();
  const listId = String(formData.get("listId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name) redirect(listsHref(undefined, "A list needs a name"));

  await prisma.importList.update({
    where: { id: listId },
    data: { name: name.slice(0, 200), note: note.slice(0, 500) || null },
  });

  revalidatePath("/admin/lists");
  redirect(listsHref("List updated"));
}

/**
 * Removes the folder, not the leads. The customers stay exactly where they are and
 * simply stop belonging to a list (the foreign key is SET NULL) — deleting a record of
 * a file must never destroy the leads it brought in.
 */
export async function deleteList(formData: FormData) {
  const session = await requireAdmin();
  const listId = String(formData.get("listId") ?? "");

  const list = await prisma.importList.findUnique({
    where: { id: listId },
    select: { id: true, name: true, _count: { select: { customers: true } } },
  });
  if (!list) redirect(listsHref(undefined, "That list no longer exists"));

  await prisma.importList.delete({ where: { id: list.id } });

  await logActivity({
    userId: session.userId,
    action: "LIST_DELETED",
    entity: "ImportList",
    entityId: list.id,
    detail: `${list.name} removed; its ${list._count.customers} lead(s) kept`,
  });

  revalidatePath("/admin/lists");
  revalidatePath("/admin/customers");
  redirect(listsHref(`${list.name} removed — its ${list._count.customers} lead(s) were kept`));
}

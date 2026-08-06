"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { CLOSED_STATUSES } from "@/lib/queue";
import { findUnfiledGroups } from "@/lib/lead-grouping";
import { formatDateTime } from "@/lib/datetime";

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
      memberships: { some: { listId: list.id } },
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
    where: { memberships: { some: { listId: list.id } }, status: "NEW", calls: { none: {} } },
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
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  if (!list) redirect(listsHref(undefined, "That list no longer exists"));

  await prisma.importList.delete({ where: { id: list.id } });

  await logActivity({
    userId: session.userId,
    action: "LIST_DELETED",
    entity: "ImportList",
    entityId: list.id,
    detail: `${list.name} removed; its ${list._count.members} lead(s) kept`,
  });

  revalidatePath("/admin/lists");
  revalidatePath("/admin/customers");
  redirect(listsHref(`${list.name} removed — its ${list._count.members} lead(s) were kept`));
}


/**
 * Files the leads that arrived before lists existed.
 *
 * Their original filenames are gone, so the grouping is reconstructed from creation
 * time: an upload writes its rows in one burst, so a run of rows created together was
 * one file. Each group becomes a list named for when it landed and marked as
 * reconstructed, so nobody mistakes it for the real filename.
 *
 * Safe to re-run: it only ever touches leads that belong to no list yet.
 */
export async function groupUnfiledLeads() {
  const session = await requireAdmin();
  const groups = await findUnfiledGroups();

  if (groups.length === 0) {
    redirect(listsHref("Every lead is already in a list"));
  }

  let filed = 0;
  for (const group of groups) {
    // The bucket is a minute, so the end of the window is the end of that minute.
    const until = new Date(group.to.getTime() + 60 * 1000);

    const list = await prisma.importList.create({
      data: {
        name: `Imported ${formatDateTime(group.from)}`,
        note: "Reconstructed from upload time — the original filename was not recorded",
        rowsImported: group.count,
        uploadedById: session.userId,
      },
    });

    // Only leads still unfiled, inside this window. Two statements rather than a
    // read-then-write so 27,000 rows do not travel through the app.
    await prisma.$executeRaw`
      UPDATE "Customer" c
      SET "listId" = ${list.id}
      WHERE c."createdAt" >= ${group.from} AND c."createdAt" < ${until}
        AND NOT EXISTS (SELECT 1 FROM "ListMembership" m WHERE m."customerId" = c."id")
    `;
    const inserted = await prisma.$executeRaw`
      INSERT INTO "ListMembership" ("id", "listId", "customerId", "isOrigin", "createdAt")
      SELECT 'lm_' || substr(md5(c."id" || ':' || ${list.id}), 1, 22), ${list.id}, c."id", true, now()
      FROM "Customer" c
      WHERE c."listId" = ${list.id}
        AND NOT EXISTS (SELECT 1 FROM "ListMembership" m WHERE m."customerId" = c."id")
      ON CONFLICT DO NOTHING
    `;
    filed += inserted;
  }

  await logActivity({
    userId: session.userId,
    action: "LEADS_GROUPED",
    entity: "ImportList",
    detail: `${filed} unfiled lead(s) grouped into ${groups.length} list(s) by upload time`,
  });

  revalidatePath("/admin/lists");
  revalidatePath("/admin/customers");
  redirect(listsHref(`${filed.toLocaleString("en-IN")} leads filed into ${groups.length} list(s)`));
}

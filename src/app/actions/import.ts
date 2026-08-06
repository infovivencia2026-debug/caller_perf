"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/labels";

const rowSchema = z.object({
  name: z.string().optional(),
  phone: z.string().min(1),
  company: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

export type ImportRow = z.infer<typeof rowSchema>;

export type ImportResult = {
  /** The list this upload created; passed back in for subsequent chunks. */
  listId?: string;
  imported: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
  invalid: { row: number; reason: string }[];
  error?: string;
};

/** Commits previewed rows. Duplicates are skipped, never overwritten. */
export async function importCustomers(
  rows: unknown,
  assignedToId: string | null,
  /**
   * The upload this call belongs to. Large files are sent in chunks, so the first
   * chunk passes the file's name and gets a list back; every later chunk passes that
   * id, and the whole file ends up as one list rather than one list per chunk.
   */
  upload?: { fileName?: string; listId?: string },
): Promise<ImportResult> {
  const session = await requireAdmin();
  const empty: ImportResult = { imported: 0, duplicatesInFile: 0, duplicatesInDb: 0, invalid: [] };

  if (!Array.isArray(rows)) return { ...empty, error: "No rows to import" };
  if (rows.length > 20000) return { ...empty, error: "File too large — split into batches of 20,000 rows" };

  const invalid: ImportResult["invalid"] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;
  const candidates: { name: string; phone: string; company: string | null; email: string | null; city: string | null; notes: string | null }[] = [];

  rows.forEach((raw, index) => {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.push({ row: index + 2, reason: "A phone number is required" });
      return;
    }
    const phone = normalizePhone(parsed.data.phone);
    if (phone.length < 7) {
      invalid.push({ row: index + 2, reason: `Invalid phone "${parsed.data.phone}"` });
      return;
    }
    if (seen.has(phone)) {
      duplicatesInFile += 1;
      return;
    }
    seen.add(phone);
    candidates.push({
      name: parsed.data.name?.trim() || "",
      phone,
      company: parsed.data.company?.trim() || null,
      email: parsed.data.email?.trim() || null,
      city: parsed.data.city?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    });
  });

  const existing = await prisma.customer.findMany({
    where: { phone: { in: candidates.map((row) => row.phone) } },
    select: { id: true, phone: true },
  });
  const existingPhones = new Set(existing.map((row) => row.phone));
  const toCreate = candidates.filter((row) => !existingPhones.has(row.phone));

  // Every upload becomes its own list, and the leads it creates belong to it — so a
  // file can be browsed, assigned and reported on as a unit later. Created even when
  // every row was a duplicate, so the upload still leaves a trace of having happened.
  const list = upload?.listId
    ? await prisma.importList.update({
        where: { id: upload.listId },
        // Later chunks of the same file add to the running totals.
        data: {
          rowsImported: { increment: toCreate.length },
          rowsDuplicate: { increment: duplicatesInFile + existingPhones.size },
          rowsInvalid: { increment: invalid.length },
        },
      })
    : await prisma.importList.create({
        data: {
          name: (upload?.fileName?.trim() || "Untitled upload").slice(0, 200),
          uploadedById: session.userId,
          rowsImported: toCreate.length,
          rowsDuplicate: duplicatesInFile + existingPhones.size,
          rowsInvalid: invalid.length,
        },
      });

  if (toCreate.length > 0) {
    await prisma.customer.createMany({
      data: toCreate.map((row) => ({ ...row, assignedToId: assignedToId || null, listId: list.id })),
    });
  }

  // The file's identity is every row it contained — including numbers an earlier file
  // already introduced, which are not re-imported but were still in this file. Without
  // this the list under-reports itself and assigning "from this file" skips them.
  const phonesInChunk = candidates.map((row) => row.phone);
  if (phonesInChunk.length > 0) {
    const members = await prisma.customer.findMany({
      where: { phone: { in: phonesInChunk } },
      select: { id: true, listId: true },
    });
    await prisma.listMembership.createMany({
      data: members.map((member) => ({
        listId: list.id,
        customerId: member.id,
        // Origin is the file that introduced the lead, which is this one only if the
        // lead's own origin points back here.
        isOrigin: member.listId === list.id,
      })),
      skipDuplicates: true,
    });
  }

  const assignee = assignedToId
    ? await prisma.user.findUnique({ where: { id: assignedToId }, select: { name: true } })
    : null;

  await logActivity({
    userId: session.userId,
    action: "CSV_IMPORT",
    entity: "Customer",
    entityId: list.id,
    detail: `${list.name}: ${toCreate.length} imported, ${existingPhones.size} existing, ${duplicatesInFile} duplicate rows, ${invalid.length} invalid${
      assignee ? `, assigned to ${assignee.name}` : ", unassigned"
    }`,
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/lists");
  revalidatePath("/admin");

  return {
    listId: list.id,
    imported: toCreate.length,
    duplicatesInFile,
    duplicatesInDb: existingPhones.size,
    invalid: invalid.slice(0, 50),
  };
}

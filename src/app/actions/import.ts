"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/labels";

const rowSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  company: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

export type ImportRow = z.infer<typeof rowSchema>;

export type ImportResult = {
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
      invalid.push({ row: index + 2, reason: "Name and phone are required" });
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
      name: parsed.data.name.trim(),
      phone,
      company: parsed.data.company?.trim() || null,
      email: parsed.data.email?.trim() || null,
      city: parsed.data.city?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    });
  });

  const existing = await prisma.customer.findMany({
    where: { phone: { in: candidates.map((row) => row.phone) } },
    select: { phone: true },
  });
  const existingPhones = new Set(existing.map((row) => row.phone));
  const toCreate = candidates.filter((row) => !existingPhones.has(row.phone));

  if (toCreate.length > 0) {
    await prisma.customer.createMany({
      data: toCreate.map((row) => ({ ...row, assignedToId: assignedToId || null })),
    });
  }

  await logActivity({
    userId: session.userId,
    action: "CSV_IMPORT",
    entity: "Customer",
    detail: `${toCreate.length} imported, ${existingPhones.size} existing, ${duplicatesInFile} duplicate rows, ${invalid.length} invalid`,
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin");

  return {
    imported: toCreate.length,
    duplicatesInFile,
    duplicatesInDb: existingPhones.size,
    invalid: invalid.slice(0, 50),
  };
}

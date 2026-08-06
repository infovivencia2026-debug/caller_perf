import { prisma } from "@/lib/prisma";

/**
 * Leads imported before lists existed carry no record of which file they came from.
 * What they do carry is a creation time, and an upload writes its rows in one burst —
 * so a run of rows created close together is, with high confidence, one file.
 *
 * This finds those bursts. It is a reconstruction, not a recovery: the groups are
 * labelled by their upload time and marked as reconstructed, because the original
 * filenames are genuinely gone.
 */

/** A gap longer than this between consecutive rows starts a new group. */
const GAP_MINUTES = 20;

export type LeadGroup = {
  from: Date;
  to: Date;
  count: number;
};

/**
 * Buckets unfiled leads by creation minute, then joins adjacent minutes into groups.
 * Counting by minute keeps this to a few hundred rows however many leads there are.
 */
export async function findUnfiledGroups(): Promise<LeadGroup[]> {
  const rows = await prisma.$queryRaw<{ minute: Date; count: bigint }[]>`
    SELECT date_trunc('minute', c."createdAt") AS minute, count(*) AS count
    FROM "Customer" c
    WHERE NOT EXISTS (SELECT 1 FROM "ListMembership" m WHERE m."customerId" = c."id")
    GROUP BY 1
    ORDER BY 1
  `;

  const groups: LeadGroup[] = [];
  for (const row of rows) {
    const minute = new Date(row.minute);
    const count = Number(row.count);
    const current = groups[groups.length - 1];

    if (current && minute.getTime() - current.to.getTime() <= GAP_MINUTES * 60 * 1000) {
      current.to = minute;
      current.count += count;
    } else {
      groups.push({ from: minute, to: minute, count });
    }
  }

  // Newest first, matching how the lists page reads.
  return groups.reverse();
}

import { normalizePhone } from "@/lib/labels";
import type { Prisma } from "@/generated/prisma/client";

export type CustomerFilter = {
  q?: string;
  status?: string;
  caller?: string;
  priority?: string;
};

/**
 * Builds the Prisma where-clause for the customer list. Shared by the list page and the
 * "delete matching" action so the count shown and the rows deleted are always identical.
 */
export function buildCustomerWhere(params: CustomerFilter): Prisma.CustomerWhereInput {
  const q = params.q?.trim() ?? "";
  return {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.priority ? { priority: params.priority as never } : {}),
    ...(params.caller
      ? params.caller === "unassigned"
        ? { assignedToId: null }
        : { assignedToId: params.caller }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { phone: { contains: normalizePhone(q) || q } },
          ],
        }
      : {}),
  };
}

/** True when at least one filter is set — i.e. the delete would not wipe every customer. */
export function hasAnyFilter(params: CustomerFilter): boolean {
  return Boolean(params.q?.trim() || params.status || params.caller || params.priority);
}

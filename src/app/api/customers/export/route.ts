import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/labels";
import { parseTags } from "@/lib/tags";
import type { Prisma } from "@/generated/prisma/client";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const caller = url.searchParams.get("caller");

  const where: Prisma.CustomerWhereInput = {
    ...(status ? { status: status as never } : {}),
    ...(priority ? { priority: priority as never } : {}),
    ...(caller ? (caller === "unassigned" ? { assignedToId: null } : { assignedToId: caller }) : {}),
    ...(q
      ? {
          OR: [
            // Case-insensitive to match the customer list; Postgres LIKE is not by default.
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { phone: { contains: normalizePhone(q) || q } },
          ],
        }
      : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    include: { assignedTo: { select: { name: true } }, _count: { select: { calls: true } } },
  });

  const header = [
    "name",
    "phone",
    "company",
    "email",
    "city",
    "status",
    "priority",
    "tags",
    "assigned_caller",
    "total_calls",
    "notes",
  ];
  const lines = [
    header.join(","),
    ...customers.map((customer) =>
      [
        customer.name,
        // ="…" keeps Excel from reading the phone as a number and rounding it.
        `="${customer.phone}"`,
        customer.company,
        customer.email,
        customer.city,
        customer.status,
        customer.priority,
        parseTags(customer.tags).join("; "),
        customer.assignedTo?.name ?? "",
        customer._count.calls,
        customer.notes,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers.csv"`,
    },
  });
}

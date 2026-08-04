import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import { resolveFilters } from "@/lib/report-filters";
import type { Prisma } from "@/generated/prisma/client";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Exports the call log — every call with its response, comments, timing and outcome —
 *  as a CSV that Excel/Sheets open directly. Honours the same period + telecaller filters
 *  as the Call log screen. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = resolveFilters({
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    caller: url.searchParams.get("caller") ?? undefined,
  });

  const where: Prisma.CallWhereInput = {
    ...(filters.callerId ? { callerId: filters.callerId } : {}),
    ...(filters.from || filters.to
      ? { startedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
      : {}),
  };

  const calls = await prisma.call.findMany({
    where,
    orderBy: { startedAt: "desc" },
    select: {
      startedAt: true,
      endedAt: true,
      duration: true,
      status: true,
      response: true,
      comments: true,
      caller: { select: { name: true } },
      customer: { select: { name: true, phone: true, company: true, city: true } },
      // The callback/follow-up scheduled off this call, so its due time exports too.
      followUp: { select: { dueAt: true } },
    },
  });

  const header = [
    "started_at",
    "ended_at",
    "duration_seconds",
    "telecaller",
    "customer",
    "phone",
    "company",
    "city",
    "outcome",
    "follow_up_scheduled_for",
    "customer_response",
    "caller_comments",
  ];

  const lines = [
    header.join(","),
    ...calls.map((c) =>
      [
        formatDateTime(c.startedAt),
        formatDateTime(c.endedAt),
        c.duration,
        c.caller.name,
        c.customer.name,
        c.customer.phone,
        c.customer.company,
        c.customer.city,
        humanize(c.status),
        c.followUp ? formatDateTime(c.followUp.dueAt) : "",
        c.response,
        c.comments,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  // Prepend a BOM so Excel reads the UTF-8 correctly.
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="call-log.csv"`,
    },
  });
}

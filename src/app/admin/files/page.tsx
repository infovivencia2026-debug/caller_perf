import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";
import { humanize } from "@/lib/labels";
import { CLOSED_STATUSES } from "@/lib/queue";
import { deleteList, deleteListWithLeads } from "@/app/actions/lists";

export const dynamic = "force-dynamic";

/** The order statuses are shown in each file's breakdown. */
const STATUS_ORDER = [
  "NEW",
  "IN_PROGRESS",
  "CALLBACK",
  "INTERESTED",
  "MEETING_SCHEDULED",
  "NO_ANSWER",
  "BUSY",
  "NOT_INTERESTED",
  "CLOSED",
  "INVALID",
];

type StatusRow = { listId: string; status: string; count: bigint };

/**
 * Per-file overview + analytics: how many numbers a file holds, how many are still
 * assignable, out with counsellors, or called — plus a full status breakdown per file.
 */
export default async function FileSettings() {
  await requireAdmin();

  const lists = await prisma.importList.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, name: true, note: true, createdAt: true, _count: { select: { members: true } } },
  });

  // One grouped query for the whole status breakdown, rather than a query per status.
  const statusRows = await prisma.$queryRaw<StatusRow[]>`
    SELECT m."listId", c."status"::text AS status, count(*)::bigint AS count
    FROM "ListMembership" m
    JOIN "Customer" c ON c."id" = m."customerId"
    GROUP BY m."listId", c."status"
  `;
  const statusByList = new Map<string, Record<string, number>>();
  for (const r of statusRows) {
    const bucket = statusByList.get(r.listId) ?? {};
    bucket[r.status] = Number(r.count);
    statusByList.set(r.listId, bucket);
  }

  const rows = await Promise.all(
    lists.map(async (list) => {
      const member = { memberships: { some: { listId: list.id } } };
      const [remaining, assigned, called] = await Promise.all([
        // Assignable pool: never-called, unassigned, still-open.
        prisma.customer.count({
          where: { ...member, assignedToId: null, calls: { none: {} }, status: { notIn: CLOSED_STATUSES as unknown as never } },
        }),
        prisma.customer.count({ where: { ...member, assignedToId: { not: null } } }),
        prisma.customer.count({ where: { ...member, calls: { some: {} } } }),
      ]);
      const statuses = statusByList.get(list.id) ?? {};
      return { ...list, remaining, assigned, called, statuses };
    }),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + r._count.members,
      remaining: acc.remaining + r.remaining,
      assigned: acc.assigned + r.assigned,
      called: acc.called + r.called,
    }),
    { current: 0, remaining: 0, assigned: 0, called: 0 },
  );

  const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <div className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className={`text-lg font-bold tabular-nums ${tone ?? ""}`}>{value.toLocaleString("en-IN")}</div>
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">File settings</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">{rows.length} files</p>
      </div>

      {/* Overall totals across every file. */}
      <Card title="All files — totals">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Current numbers" value={totals.current} />
          <Stat label="Remaining" value={totals.remaining} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Assigned" value={totals.assigned} />
          <Stat label="Called" value={totals.called} />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card title="No files">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No files uploaded yet.</p>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id} title={r.name}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{formatDateTime(r.createdAt)}</span>
                {r.note && <span className="break-words">· {r.note}</span>}
                <Link
                  href={`/admin/customers?list=${r.id}`}
                  className="font-bold uppercase tracking-wide underline underline-offset-2"
                >
                  Open →
                </Link>
              </div>

              {/* Headline counts. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Current" value={r._count.members} />
                <Stat label="Remaining" value={r.remaining} tone="text-emerald-600 dark:text-emerald-400" />
                <Stat label="Assigned" value={r.assigned} />
                <Stat label="Called" value={r.called} />
              </div>

              {/* Full status breakdown — the analytics for this file. */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Status breakdown
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_ORDER.filter((s) => r.statuses[s]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1">
                      <Badge tone={statusTone(s)}>
                        {humanize(s)} · {r.statuses[s].toLocaleString("en-IN")}
                      </Badge>
                    </span>
                  ))}
                  {Object.keys(r.statuses).length === 0 && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">No leads.</span>
                  )}
                </div>
              </div>

              {/* Destructive actions, tucked behind a toggle. */}
              <details className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2">
                <summary className="cursor-pointer text-sm font-semibold text-rose-700 dark:text-rose-300">
                  Delete…
                </summary>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <form action={deleteList} className="sm:flex-1">
                    <input type="hidden" name="listId" value={r.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-neutral-500/10 dark:border-neutral-700"
                    >
                      Remove file (keep leads)
                    </button>
                  </form>
                  <form action={deleteListWithLeads} className="sm:flex-1">
                    <input type="hidden" name="listId" value={r.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-500/20 dark:text-rose-300"
                    >
                      Delete file &amp; {r._count.members.toLocaleString("en-IN")} lead(s)
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </Card>
        ))
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        <strong>Remaining</strong> = numbers still assignable (never called, not yet assigned, still open).{" "}
        <strong>Called</strong> = numbers in the file with at least one call. The status breakdown counts every lead
        in the file by its current status.
      </p>
    </div>
  );
}

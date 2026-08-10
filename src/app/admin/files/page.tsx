import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";
import { CLOSED_STATUSES } from "@/lib/queue";
import { deleteList, deleteListWithLeads } from "@/app/actions/lists";

export const dynamic = "force-dynamic";

/**
 * Per-file overview: how many numbers a file holds now, how many are still assignable
 * ("remaining"), how many are out with counsellors, and how many have been called.
 */
export default async function FileSettings() {
  await requireAdmin();

  const lists = await prisma.importList.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, name: true, note: true, createdAt: true, _count: { select: { members: true } } },
  });

  // For each file, the counts admins actually ask about. Run per-file in parallel — a
  // few hundred files at most, and these are cheap indexed counts.
  const rows = await Promise.all(
    lists.map(async (list) => {
      const member = { memberships: { some: { listId: list.id } } };
      const [remaining, assigned, called] = await Promise.all([
        // Assignable pool: never-called, unassigned, still-open.
        prisma.customer.count({
          where: {
            ...member,
            assignedToId: null,
            calls: { none: {} },
            status: { notIn: CLOSED_STATUSES as unknown as never },
          },
        }),
        prisma.customer.count({ where: { ...member, assignedToId: { not: null } } }),
        prisma.customer.count({ where: { ...member, calls: { some: {} } } }),
      ]);
      return { ...list, remaining, assigned, called };
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">File settings</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">{rows.length} files</p>
      </div>

      <Card title="All files">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No files uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-bold">File</th>
                  <th className="px-3 py-2 font-bold">Uploaded</th>
                  <th className="px-3 py-2 text-right font-bold">Current numbers</th>
                  <th className="px-3 py-2 text-right font-bold">Remaining (assignable)</th>
                  <th className="px-3 py-2 text-right font-bold">Assigned</th>
                  <th className="px-3 py-2 text-right font-bold">Called</th>
                  <th className="px-3 py-2 font-bold">Manage</th>
                  <th className="px-3 py-2 font-bold">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">
                      {r.name}
                      {r.note && (
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">{r.note}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r._count.members.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      {r.remaining.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.assigned.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.called.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/customers?list=${r.id}`}
                        className="font-bold uppercase tracking-wide underline underline-offset-2"
                      >
                        Open →
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {/* Destructive actions kept behind a toggle so neither is a stray click away. */}
                      <details className="min-w-[13rem]">
                        <summary className="cursor-pointer text-sm font-bold text-rose-700 dark:text-rose-300">
                          Delete…
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                          <form action={deleteList}>
                            <input type="hidden" name="listId" value={r.id} />
                            <button
                              type="submit"
                              className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-neutral-500/10 dark:border-neutral-700"
                            >
                              Remove file (keep leads)
                            </button>
                          </form>
                          <form action={deleteListWithLeads}>
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
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-neutral-300 font-semibold dark:border-neutral-700">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.current.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                    {totals.remaining.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.assigned.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.called.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        <strong>Remaining</strong> = numbers still assignable (never called, not yet assigned, still open).{" "}
        <strong>Called</strong> counts any number in the file that has at least one call. Open a file to rename it,
        share it out, or delete it.
      </p>
    </div>
  );
}

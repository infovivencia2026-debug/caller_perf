import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { assignFromList, deleteList, groupUnfiledLeads, unassignList, updateList } from "@/app/actions/lists";
import { findUnfiledGroups } from "@/lib/lead-grouping";
import {
  BentoStat,
  BentoTile,
  bentoButtonClass,
  bentoGhostButtonClass,
  bentoInputClass,
} from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/**
 * Uploaded files, as folders. Each import is its own set of leads, and this is where an
 * admin sees what came in, how much of it has been handed out, how far through it the
 * counsellors are — and assigns the next slice of a specific file to a specific person.
 */
export default async function Lists({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; open?: string }>;
}) {
  await requireAdmin();
  const { message, error, open } = await searchParams;

  const [lists, callers, looseCount] = await Promise.all([
    prisma.importList.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "TELECALLER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Leads that belong to no file: added by hand, or imported before lists existed.
    prisma.customer.count({ where: { memberships: { none: {} } } }),
  ]);

  // What filing the older leads would produce, shown before anyone commits to it.
  const unfiledGroups = looseCount > 0 ? await findUnfiledGroups() : [];

  // Per-list breakdown in one round trip each, rather than N queries per list.
  const [assignedCounts, calledCounts] = await Promise.all([
    prisma.listMembership.groupBy({
      by: ["listId"],
      where: { customer: { assignedToId: { not: null } } },
      _count: { _all: true },
    }),
    prisma.listMembership.groupBy({
      by: ["listId"],
      where: { customer: { status: { not: "NEW" } } },
      _count: { _all: true },
    }),
  ]);
  const assignedBy = new Map(assignedCounts.map((row) => [row.listId, row._count._all]));
  const calledBy = new Map(calledCounts.map((row) => [row.listId, row._count._all]));

  const totalLeads = lists.reduce((sum, list) => sum + list._count.members, 0);
  const totalAssigned = [...assignedBy.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
        <h1 className="text-lg font-semibold">Lead lists</h1>
        <Link href="/admin/customers/import" className={bentoButtonClass}>
          Upload a file
        </Link>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="bento-grid">
        <BentoStat label="Lists" value={lists.length} span={3} glow="indigo" hint="Uploaded files" />
        <BentoStat label="Leads in lists" value={totalLeads.toLocaleString("en-IN")} span={3} glow="sky" />
        <BentoStat
          label="Assigned"
          value={totalAssigned.toLocaleString("en-IN")}
          span={3}
          glow="emerald"
          hint={totalLeads ? `${Math.round((totalAssigned / totalLeads) * 100)}% handed out` : undefined}
        />
        <BentoStat
          label="Not in any list"
          value={looseCount.toLocaleString("en-IN")}
          span={3}
          glow="amber"
          hint="Added by hand or before lists"
        />
      </div>

      {/* The leads that arrived before lists existed. Offered as a preview first —
          this is a reconstruction from upload times, not a recovery of filenames. */}
      {unfiledGroups.length > 0 && (
        <BentoTile title={`Unfiled leads (${looseCount.toLocaleString("en-IN")})`} glow="amber">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            These arrived before lists existed, so no filename was recorded. They can be filed by when they were
            uploaded — an import writes its rows in one burst, so each burst below was almost certainly one file.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {unfiledGroups.slice(0, 8).map((group) => (
              <li key={group.from.toISOString()} className="flex flex-wrap justify-between gap-2">
                <span>{formatDateTime(group.from)}</span>
                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                  {group.count.toLocaleString("en-IN")} leads
                </span>
              </li>
            ))}
          </ul>
          {unfiledGroups.length > 8 && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              …and {unfiledGroups.length - 8} more group{unfiledGroups.length - 8 === 1 ? "" : "s"}.
            </p>
          )}
          <form action={groupUnfiledLeads} className="mt-3">
            <button type="submit" className={bentoButtonClass}>
              File into {unfiledGroups.length} list{unfiledGroups.length === 1 ? "" : "s"}
            </button>
          </form>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Each list is named for when it landed and marked as reconstructed. Nothing is moved or deleted — leads are
            only labelled, and lists can be renamed or removed afterwards.
          </p>
        </BentoTile>
      )}

      {lists.length === 0 ? (
        <BentoTile title="No lists yet" glow="indigo">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Every file you upload from now on becomes its own list, and you can assign leads a file at a time.{" "}
            <Link href="/admin/customers/import" className="font-semibold underline underline-offset-2">
              Upload one
            </Link>
            .
          </p>
        </BentoTile>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => {
            const total = list._count.members;
            const assigned = assignedBy.get(list.id) ?? 0;
            const called = calledBy.get(list.id) ?? 0;
            const unassigned = total - assigned;
            const pct = total ? Math.round((assigned / total) * 100) : 0;
            const isOpen = open === list.id;

            return (
              <section key={list.id} data-glow="indigo" className="bento p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">{list.name}</h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(list.createdAt)}
                      {list.uploadedBy ? ` · ${list.uploadedBy.name}` : ""}
                      {list.rowsDuplicate > 0 ? ` · ${list.rowsDuplicate} duplicate rows skipped` : ""}
                    </p>
                    {list.note && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{list.note}</p>}
                  </div>
                  <Link
                    href={`/admin/customers?list=${list.id}`}
                    className={`${bentoGhostButtonClass} shrink-0`}
                  >
                    View leads
                  </Link>
                </div>

                {/* How far through the file we are, at a glance. */}
                <div className="mt-3">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>
                      <strong className="text-black dark:text-white">{total.toLocaleString("en-IN")}</strong> leads ·{" "}
                      {assigned.toLocaleString("en-IN")} assigned · {unassigned.toLocaleString("en-IN")} free ·{" "}
                      {called.toLocaleString("en-IN")} worked
                    </span>
                    <span className="tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Hand the next slice of this file to someone. */}
                <form action={assignFromList} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="listId" value={list.id} />
                  <select name="callerId" required defaultValue="" className={bentoInputClass}>
                    <option value="" disabled>
                      Assign to…
                    </option>
                    {callers.map((caller) => (
                      <option key={caller.id} value={caller.id}>
                        {caller.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    name="count"
                    min={1}
                    max={Math.max(1, unassigned)}
                    defaultValue={Math.min(50, Math.max(1, unassigned))}
                    aria-label="How many leads"
                    className={`${bentoInputClass} sm:w-28`}
                  />
                  <button type="submit" className={bentoButtonClass} disabled={unassigned === 0}>
                    Assign
                  </button>
                </form>
                {unassigned === 0 && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Every lead in this list is assigned.
                  </p>
                )}

                {/* Rename, return and remove are all one-off admin jobs — folded away so
                    the common action above stays the obvious one. */}
                {/* Renaming is the common edit, so it is not hidden. */}
                <form action={updateList} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="listId" value={list.id} />
                  <input name="name" defaultValue={list.name} aria-label="File name" className={bentoInputClass} />
                  <input
                    name="note"
                    defaultValue={list.note ?? ""}
                    placeholder="Where these leads came from"
                    aria-label="Note"
                    className={bentoInputClass}
                  />
                  <button type="submit" className={bentoGhostButtonClass}>
                    Rename
                  </button>
                </form>

                <details className="mt-3" open={isOpen}>
                  <summary className="cursor-pointer text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Return leads or remove this list
                  </summary>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={unassignList}>
                      <input type="hidden" name="listId" value={list.id} />
                      <button type="submit" className={bentoGhostButtonClass}>
                        Return untouched leads
                      </button>
                    </form>
                    <form action={deleteList}>
                      <input type="hidden" name="listId" value={list.id} />
                      <button type="submit" className={bentoGhostButtonClass}>
                        Remove list (keeps leads)
                      </button>
                    </form>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Returning only takes back leads nobody has called yet. Removing the list deletes the folder, never
                    the leads.
                  </p>
                </details>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Card, Badge, statusTone } from "@/components/ui";
import { customerLabel, humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type FollowUpRow = {
  id: string;
  dueAt: Date;
  customer: { id: string; name: string | null; phone: string; status: string } | null;
  caller: { name: string } | null;
};

function FollowUpTable({ rows }: { rows: FollowUpRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">None.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-bold">Due</th>
            <th className="px-3 py-2 font-bold">Customer</th>
            <th className="px-3 py-2 font-bold">Phone</th>
            <th className="px-3 py-2 font-bold">Counsellor</th>
            <th className="px-3 py-2 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((f) => (
            <tr key={f.id}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(f.dueAt)}</td>
              <td className="px-3 py-2 font-medium">
                {f.customer ? (
                  <Link href={`/admin/customers/${f.customer.id}`} className="hover:underline">
                    {customerLabel(f.customer)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 tabular-nums">{f.customer?.phone ?? "—"}</td>
              <td className="px-3 py-2">{f.caller?.name ?? "—"}</td>
              <td className="px-3 py-2">
                {f.customer && <Badge tone={statusTone(f.customer.status)}>{humanize(f.customer.status)}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Admin oversight of scheduled work: interested leads awaiting follow-up, and every other
 * scheduled callback — across all counsellors, soonest first.
 */
export default async function AdminFollowUps() {
  await requireAdmin();

  const followUps = await prisma.followUp.findMany({
    where: { status: "PENDING" },
    orderBy: { dueAt: "asc" },
    take: 500,
    include: {
      customer: { select: { id: true, name: true, phone: true, status: true } },
      caller: { select: { name: true } },
    },
  });

  const interested = followUps.filter((f) => f.customer?.status === "INTERESTED");
  const callbacks = followUps.filter((f) => f.customer?.status !== "INTERESTED");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">Follow-ups</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {interested.length} interested · {callbacks.length} scheduled callbacks
        </p>
      </div>

      <Card title={`Interested follow-ups (${interested.length})`} glow="emerald">
        <FollowUpTable rows={interested} />
      </Card>

      <Card title={`Scheduled callbacks (${callbacks.length})`} glow="amber">
        <FollowUpTable rows={callbacks} />
      </Card>
    </div>
  );
}

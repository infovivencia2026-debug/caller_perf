import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, buttonClass, statusTone } from "@/components/ui";
import { customerLabel, humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import { endOfDay, startOfDay } from "@/lib/metrics";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

/** Scheduled callbacks for leads that are NOT (yet) interested — the counterpart to the
 *  Follow-ups page, which holds interested leads only. */
export default async function CallbacksPage() {
  const session = await requireCaller();
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const callbacks = await prisma.followUp.findMany({
    where: {
      callerId: session.userId,
      status: "PENDING",
      dueAt: { lt: todayEnd },
      customer: { is: { status: { not: "INTERESTED" } } },
    },
    orderBy: { dueAt: "asc" },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, company: true, city: true, status: true, notes: true },
      },
    },
  });

  const overdue = callbacks.filter((f) => f.dueAt < todayStart);
  const dueToday = callbacks.filter((f) => f.dueAt >= todayStart);

  const Item = ({ fu }: { fu: (typeof callbacks)[number] }) => (
    <li className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">{customerLabel(fu.customer)}</span>
        <span className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Due {formatDateTime(fu.dueAt)}</span>
          <Link href={`/caller/call?focus=${fu.customer.id}`} className={buttonClass}>
            Call
          </Link>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium tabular-nums tracking-wide text-slate-900 dark:text-slate-100">
          {fu.customer.phone}
        </span>
        {fu.customer.company && <span>{fu.customer.company}</span>}
        {fu.customer.city && <span>{fu.customer.city}</span>}
        <Badge tone={statusTone(fu.customer.status)}>{humanize(fu.customer.status)}</Badge>
        <span className="text-slate-500 dark:text-slate-400">{humanize(fu.priority)} priority</span>
      </div>
      {fu.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{fu.notes}</p>}
    </li>
  );

  return (
    <div className="space-y-3">
      <AutoRefresh />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Callbacks</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {overdue.length} overdue · {dueToday.length} due today
        </p>
      </div>

      {callbacks.length === 0 ? (
        <Card title="All clear">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No callbacks due today. Interested leads are on the Follow-ups page.
          </p>
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card title={`Overdue (${overdue.length})`}>
              <ul>
                {overdue.map((fu) => (
                  <Item key={fu.id} fu={fu} />
                ))}
              </ul>
            </Card>
          )}
          {dueToday.length > 0 && (
            <Card title={`Due today (${dueToday.length})`}>
              <ul>
                {dueToday.map((fu) => (
                  <Item key={fu.id} fu={fu} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

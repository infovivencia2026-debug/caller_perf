import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, buttonClass, statusTone } from "@/components/ui";
import { humanize } from "@/lib/labels";
import { formatDateTime, isCallbackMissed } from "@/lib/datetime";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

/** Scheduled callbacks for leads that are NOT (yet) interested — the counterpart to the
 *  Follow-ups page, which holds interested leads only. */
export default async function CallbacksPage() {
  const session = await requireCaller();

  // Every pending non-interested callback for this counsellor (any due date — upcoming
  // ones included, so nothing scheduled is hidden). Classified by the snapshot status so
  // callbacks whose lead was deleted still show up ("lead deleted").
  const callbacks = await prisma.followUp.findMany({
    where: {
      callerId: session.userId,
      status: "PENDING",
      OR: [{ customerStatus: { not: "INTERESTED" } }, { customerStatus: null }],
    },
    orderBy: { dueAt: "asc" },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, company: true, city: true, status: true, notes: true },
      },
    },
  });

  // A callback is active on its due day and the next working day; after that (Sundays not
  // counted) it drops to the Missed list. Saturday's callbacks therefore surface on Monday.
  const missed = callbacks.filter((f) => isCallbackMissed(f.dueAt));
  const active = callbacks.filter((f) => !isCallbackMissed(f.dueAt));

  const Item = ({ fu }: { fu: (typeof callbacks)[number] }) => {
    // Fall back to the snapshot when the underlying lead has been deleted.
    const name = fu.customer?.name ?? fu.customerName;
    const phone = fu.customer?.phone ?? fu.customerPhone;
    const status = fu.customer?.status ?? fu.customerStatus;
    const label = name?.trim() || phone || "Unknown";
    return (
      <li className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-base font-semibold">{label}</span>
          <span className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Due {formatDateTime(fu.dueAt)}</span>
            {fu.customer ? (
              <Link href={`/caller/call?focus=${fu.customer.id}`} className={buttonClass}>
                Call
              </Link>
            ) : (
              <Badge tone="slate">lead deleted</Badge>
            )}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium tabular-nums tracking-wide text-slate-900 dark:text-slate-100">
            {phone}
          </span>
          {fu.customer?.company && <span>{fu.customer.company}</span>}
          {fu.customer?.city && <span>{fu.customer.city}</span>}
          {status && <Badge tone={statusTone(status)}>{humanize(status)}</Badge>}
          <span className="text-slate-500 dark:text-slate-400">{humanize(fu.priority)} priority</span>
        </div>
        {fu.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{fu.notes}</p>}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <AutoRefresh />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Callbacks</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {active.length} active · {missed.length} missed
        </p>
      </div>

      {callbacks.length === 0 ? (
        <Card title="All clear">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No callbacks due. Interested leads are on the Follow-ups page.
          </p>
        </Card>
      ) : (
        <>
          <Card title={`Callbacks (${active.length})`}>
            {active.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nothing active right now.</p>
            ) : (
              <ul>
                {active.map((fu) => (
                  <Item key={fu.id} fu={fu} />
                ))}
              </ul>
            )}
          </Card>
          {missed.length > 0 && (
            <Card title={`Missed (${missed.length})`} glow="rose">
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Not called within a day of the due date. Still callable — click Call to reach them.
              </p>
              <ul>
                {missed.map((fu) => (
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

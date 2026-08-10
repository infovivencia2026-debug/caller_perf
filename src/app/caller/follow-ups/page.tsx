import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, buttonClass, statusTone } from "@/components/ui";
import { customerLabel, humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import { endOfDay, startOfDay } from "@/lib/metrics";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const session = await requireCaller();
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  // Interested leads awaiting follow-up (any due date, upcoming included). Other scheduled
  // callbacks live on the separate "Callbacks" page.
  const followUps = await prisma.followUp.findMany({
    where: {
      callerId: session.userId,
      status: "PENDING",
      customer: { is: { status: "INTERESTED" } },
    },
    orderBy: { dueAt: "asc" },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, company: true, city: true, status: true, notes: true },
      },
    },
  });

  const overdue = followUps.filter((f) => f.dueAt < todayStart);
  const dueToday = followUps.filter((f) => f.dueAt >= todayStart && f.dueAt < todayEnd);
  const upcoming = followUps.filter((f) => f.dueAt >= todayEnd);

  const Item = ({ fu }: { fu: (typeof followUps)[number] }) => (
    <li className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">{customerLabel(fu.customer)}</span>
        <span className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Due {formatDateTime(fu.dueAt)}</span>
          {/* Opens the calling screen with this customer pinned as the current one. */}
          <Link href={`/caller/call?focus=${fu.customer.id}`} className={buttonClass}>
            Call
          </Link>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        {/* Plain text — the caller dials on a separate phone, so this is just to read. */}
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
        <h1 className="text-lg font-semibold">Interested follow-ups</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {overdue.length} overdue · {dueToday.length} due today · {upcoming.length} upcoming
        </p>
      </div>

      {followUps.length === 0 ? (
        <Card title="All clear">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No interested follow-ups due today. Other scheduled callbacks are on the Callbacks page.
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
          {upcoming.length > 0 && (
            <Card title={`Upcoming (${upcoming.length})`}>
              <ul>
                {upcoming.map((fu) => (
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

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, statusTone } from "@/components/ui";
import { formatDuration, humanize } from "@/lib/labels";
import { getNextCustomer, getQueueCount } from "@/lib/queue";
import { endOfDay, isOverdue, startOfDay } from "@/lib/metrics";
import CallPanel from "./call-panel";

export const dynamic = "force-dynamic";

export default async function CallingScreen({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  const session = await requireCaller();
  const { skip } = await searchParams;
  const skipIds = (skip ?? "").split(",").filter(Boolean);

  const [customer, queueCount, callsToday, me] = await Promise.all([
    getNextCustomer(session.userId, skipIds),
    getQueueCount(session.userId),
    prisma.call.count({
      where: { callerId: session.userId, startedAt: { gte: startOfDay(), lt: endOfDay() } },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { dailyTarget: true } }),
  ]);

  if (!customer) {
    return (
      <Card title="Calling screen">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {skipIds.length > 0
            ? "You have skipped every remaining customer in your queue."
            : "No customers are assigned to you right now. Ask your admin to assign some."}
        </p>
        {skipIds.length > 0 && (
          <Link href="/caller/call" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            Start over
          </Link>
        )}
      </Card>
    );
  }

  const followUp = customer.followUps[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Calling screen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {callsToday}/{me?.dailyTarget ?? 0} calls today · {queueCount} in queue
          {skipIds.length > 0 && ` · ${skipIds.length} skipped`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <Card title="Customer">
            <dl className="space-y-2 text-sm">
              <Row label="Name">
                <span className="text-base font-semibold">{customer.name}</span>
              </Row>
              <Row label="Phone">
                <a href={`tel:${customer.phone}`} className="text-base font-semibold tabular-nums tracking-wide">
                  {customer.phone}
                </a>
              </Row>
              <Row label="Company">{customer.company ?? "—"}</Row>
              <Row label="City">{customer.city ?? "—"}</Row>
              <Row label="Email">{customer.email ?? "—"}</Row>
              <Row label="Status">
                <Badge tone={statusTone(customer.status)}>{humanize(customer.status)}</Badge>
              </Row>
              <Row label="Priority">{humanize(customer.priority)}</Row>
              {customer.tags.length > 0 && (
                <Row label="Tags">
                  <span className="space-x-1">
                    {customer.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </span>
                </Row>
              )}
            </dl>
          </Card>

          {customer.notes && (
            <Card title="Previous notes">
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{customer.notes}</p>
            </Card>
          )}

          {followUp && (
            <Card title="Follow-up due">
              <p className="text-sm">
                <Badge tone={isOverdue(followUp.dueAt) ? "red" : "amber"}>
                  {followUp.dueAt.toLocaleString()}
                </Badge>
              </p>
              {followUp.notes && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{followUp.notes}</p>
              )}
            </Card>
          )}

          <Card title={`Previous responses (${customer.calls.length})`}>
            {customer.calls.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">First contact with this customer.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {customer.calls.map((call) => (
                  <li key={call.id} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                      <span className="text-slate-500 dark:text-slate-400">
                        {call.startedAt.toLocaleString()} · {formatDuration(call.duration)}
                      </span>
                    </div>
                    {call.response && <p className="mt-1">{call.response}</p>}
                    {call.comments && (
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{call.comments}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <CallPanel
          customerId={customer.id}
          customerName={customer.name}
          phone={customer.phone}
          defaultPriority={customer.priority}
          skipped={skipIds}
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

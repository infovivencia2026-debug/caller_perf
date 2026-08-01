import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, statusTone } from "@/components/ui";
import { customerLabel, formatDuration, humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import CustomerForm from "../customer-form";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [customer, callers] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        calls: {
          orderBy: { startedAt: "desc" },
          include: { caller: { select: { name: true } } },
        },
        followUps: {
          orderBy: { dueAt: "desc" },
          include: { caller: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "TELECALLER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{customerLabel(customer)}</h1>
        <Badge tone={statusTone(customer.status)}>{humanize(customer.status)}</Badge>
        <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">{customer.phone}</span>
      </div>

      <Card title="Customer details">
        <CustomerForm customer={customer} callers={callers} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Call timeline (${customer.calls.length})`}>
          {customer.calls.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No calls logged yet.</p>
          ) : (
            <ol className="space-y-3">
              {customer.calls.map((call) => (
                <li key={call.id} className="border-l-2 border-slate-200 pl-3 text-sm dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatDateTime(call.startedAt)} · {formatDuration(call.duration)} · {call.caller.name}
                    </span>
                  </div>
                  {call.response && <p className="mt-1">Response: {call.response}</p>}
                  {call.comments && <p className="mt-1 text-slate-600 dark:text-slate-300">{call.comments}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title={`Follow-ups (${customer.followUps.length})`}>
          {customer.followUps.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No follow-ups scheduled.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.followUps.map((followUp) => (
                <li key={followUp.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(followUp.status)}>{humanize(followUp.status)}</Badge>
                  <span>{formatDateTime(followUp.dueAt)}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {humanize(followUp.priority)} · {followUp.caller.name}
                  </span>
                  {followUp.notes && <span className="w-full text-slate-600 dark:text-slate-300">{followUp.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

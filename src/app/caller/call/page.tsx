import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, Row, secondaryButtonClass, statusTone } from "@/components/ui";
import { customerLabel, formatDuration, humanize } from "@/lib/labels";
import { getAssignedCustomer, getNextCustomer, getQueueCount } from "@/lib/queue";
import { readCallTiming } from "@/lib/call-timer";
import { parseTags } from "@/lib/tags";
import { formatDateTime } from "@/lib/datetime";
import { endOfDay, startOfDay } from "@/lib/metrics";
import CallPanel from "./call-panel";

export const dynamic = "force-dynamic";

export default async function CallingScreen({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; error?: string; saved?: string; focus?: string }>;
}) {
  const session = await requireCaller();
  const { skip, error, saved, focus } = await searchParams;
  const skipIds = (skip ?? "").split(",").filter(Boolean);

  // "focus" (from a follow-up's Call button) pins a specific customer; otherwise the
  // queue picks the next one.
  const focused = focus ? await getAssignedCustomer(session.userId, focus) : null;

  const [nextInQueue, queueCount, callsToday, me, lastCall] = await Promise.all([
    focused ? Promise.resolve(null) : getNextCustomer(session.userId, skipIds),
    getQueueCount(session.userId),
    prisma.call.count({
      where: { callerId: session.userId, startedAt: { gte: startOfDay(), lt: endOfDay() } },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { dailyTarget: true } }),
    // The customer this caller finished most recently, for the "previously called" card.
    prisma.call.findFirst({
      where: { callerId: session.userId },
      orderBy: { startedAt: "desc" },
      include: { customer: true },
    }),
  ]);

  const customer = focused ?? nextInQueue;

  // Customers set aside this session, so the caller can see who they passed over.
  const skippedCustomers =
    skipIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: skipIds } },
          select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            city: true,
            email: true,
            notes: true,
            tags: true,
            status: true,
            priority: true,
            calls: {
              orderBy: { startedAt: "desc" },
              take: 1,
              select: { startedAt: true, status: true, duration: true },
            },
          },
        })
      : [];
  // Keep the order they were skipped in rather than whatever the database returns.
  const skippedInOrder = skipIds
    .map((id) => skippedCustomers.find((entry) => entry.id === id))
    .filter((entry): entry is (typeof skippedCustomers)[number] => Boolean(entry));

  const skippedCard = skippedInOrder.length > 0 && (
    <Card
      title={`Skipped this session (${skippedInOrder.length})`}
      action={
        <Link
          href={`/caller/call/skipped?skip=${skipIds.join(",")}`}
          className="text-sm font-bold uppercase tracking-wide text-black underline underline-offset-2 dark:text-white"
        >
          View details →
        </Link>
      }
    >
      <ul className="space-y-2 text-sm">
        {skippedInOrder.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{customerLabel(entry)}</span>
              <span className="tabular-nums text-slate-400">{entry.phone}</span>
              <Badge tone={statusTone(entry.status)}>{humanize(entry.status)}</Badge>
            </span>
            {/* Re-pins this customer on the calling screen so they can be called again. */}
            <Link href={`/caller/call?focus=${entry.id}&skip=${skipIds.join(",")}`} className={secondaryButtonClass}>
              Call again
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );

  if (!customer) {
    return (
      <div className="space-y-6">
        <Card title="Calling screen">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {skipIds.length > 0
              ? "You have skipped every remaining customer in your queue."
              : queueCount > 0
                ? // Customers are assigned, they have just all been called today. Saying
                  // "ask your admin to assign some" here would send the caller on a
                  // pointless errand.
                  `You have called everyone in your queue today. ${queueCount} customer${
                    queueCount === 1 ? "" : "s"
                  } will come round again tomorrow, or when a follow-up falls due.`
                : "No customers are assigned to you right now. Ask your admin to assign some."}
          </p>
          {skipIds.length > 0 && (
            <Link
              href="/caller/call"
              className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Start over
            </Link>
          )}
        </Card>
        {skippedCard}
      </div>
    );
  }

  const timing = await readCallTiming(customer.id);

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
          <Card title="Current customer">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <a
                href={`tel:${customer.phone}`}
                className="text-base font-semibold tabular-nums tracking-wide hover:underline"
              >
                {customer.phone}
              </a>
              <span className="flex items-center gap-2">
                <Badge tone={statusTone(customer.status)}>{humanize(customer.status)}</Badge>
                <span className="text-slate-500 dark:text-slate-400">{humanize(customer.priority)}</span>
              </span>
            </div>
            {parseTags(customer.tags).length > 0 && (
              <p className="mb-4 space-x-1">
                {parseTags(customer.tags).map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </p>
            )}

            {saved && (
              <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                Customer details saved.
              </p>
            )}

            {/* Read-only here; the editable fields live in the call form so edits save
                together with the call. */}
            <dl className="space-y-2 text-sm">
              <Row label="Name">{customerLabel(customer)}</Row>
              <Row label="Company">{customer.company ?? "—"}</Row>
              <Row label="City">{customer.city ?? "—"}</Row>
              <Row label="Email">{customer.email ?? "—"}</Row>
              {customer.notes && (
                <Row label="Notes">
                  <span className="whitespace-pre-wrap">{customer.notes}</span>
                </Row>
              )}
            </dl>
          </Card>

          {skippedCard}

          <Card title="Previously called">
            {!lastCall ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No calls logged yet — this is your first.
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                <Row label="Name">
                  <span className="text-base font-semibold">{customerLabel(lastCall.customer)}</span>
                </Row>
                <Row label="Phone">
                  <a
                    href={`tel:${lastCall.customer.phone}`}
                    className="tabular-nums tracking-wide hover:underline"
                  >
                    {lastCall.customer.phone}
                  </a>
                </Row>
                <Row label="Company">{lastCall.customer.company ?? "—"}</Row>
                <Row label="City">{lastCall.customer.city ?? "—"}</Row>
                <Row label="Outcome">
                  <Badge tone={statusTone(lastCall.status)}>{humanize(lastCall.status)}</Badge>
                </Row>
                <Row label="Called">
                  {formatDateTime(lastCall.startedAt)} · {formatDuration(lastCall.duration)}
                </Row>
                {lastCall.response && <Row label="Response">{lastCall.response}</Row>}
                {lastCall.comments && (
                  <Row label="Comments">
                    <span className="whitespace-pre-wrap">{lastCall.comments}</span>
                  </Row>
                )}
              </dl>
            )}
          </Card>

          {customer.notes && (
            <Card title="Previous notes">
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{customer.notes}</p>
            </Card>
          )}

          <Card title={`Previous responses (${customer.calls.length})`}>
            {customer.calls.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">First contact with this customer.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {customer.calls.map((call) => (
                  <li key={call.id}>
                    {/* Native HTML popover: opens on click with no JavaScript, so it keeps
                        working even if the client bundle fails. */}
                    <button
                      type="button"
                      popoverTarget={`call-detail-${call.id}`}
                      className="w-full cursor-pointer rounded-md border-l-2 border-slate-200 py-2 pl-3 pr-2 text-left transition-colors hover:bg-slate-100 hover:border-slate-400 focus-visible:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-500 dark:focus-visible:bg-slate-800"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                        <span className="text-slate-500 dark:text-slate-400">
                          {formatDateTime(call.startedAt)} · {formatDuration(call.duration)}
                        </span>
                      </span>
                      {call.response && <span className="mt-1 block truncate">{call.response}</span>}
                    </button>

                    <div
                      id={`call-detail-${call.id}`}
                      popover="auto"
                      className="w-[min(28rem,90vw)] rounded-none border border-black bg-white p-5 text-sm text-slate-900 backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">Call details</h3>
                        <button
                          type="button"
                          popoverTarget={`call-detail-${call.id}`}
                          popoverTargetAction="hide"
                          className="rounded-md px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>
                      <dl className="space-y-2">
                        <Row label="Customer">{customerLabel(customer)}</Row>
                        <Row label="Outcome">
                          <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                        </Row>
                        <Row label="Called">{formatDateTime(call.startedAt)}</Row>
                        <Row label="Duration">{formatDuration(call.duration)}</Row>
                        <Row label="By">{call.caller.name}</Row>
                        <Row label="Response">{call.response || "—"}</Row>
                        <Row label="Comments">
                          <span className="whitespace-pre-wrap">{call.comments || "—"}</span>
                        </Row>
                      </dl>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <CallPanel
          customerId={customer.id}
          customerName={customerLabel(customer)}
          phone={customer.phone}
          customer={{
            name: customer.name,
            company: customer.company,
            city: customer.city,
            email: customer.email,
            notes: customer.notes,
          }}
          skipped={skipIds}
          focus={focused ? focus : undefined}
          timing={timing}
          error={error}
        />
      </div>
    </div>
  );
}

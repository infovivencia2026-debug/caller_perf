import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import {
  Badge,
  BentoTile,
  Card,
  Row,
  bentoButtonClass,
  bentoGhostButtonClass,
  bentoInputClass,
  secondaryButtonClass,
  statusTone,
} from "@/components/ui";
import { callLead, customerLabel, formatDuration, humanize } from "@/lib/labels";
import { getAssignedCustomer, getNextCustomer, getQueueCount, searchAssignedCustomers, SHOULD_CALL_ONLY_STATUSES } from "@/lib/queue";
import { getShouldCallList } from "@/lib/should-call";
import { readCallTiming } from "@/lib/call-timer";
import { parseTags } from "@/lib/tags";
import { formatDateTime, formatShortTime } from "@/lib/datetime";
import { endOfDay, startOfDay } from "@/lib/metrics";
import { clearSkips } from "@/app/actions/calls";
import CallPanel from "./call-panel";

export const dynamic = "force-dynamic";

export default async function CallingScreen({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; error?: string; saved?: string; focus?: string; q?: string; last?: string }>;
}) {
  const session = await requireCaller();
  const { skip, error, saved, focus, q, last } = await searchParams;
  // The skip list lives in a cookie (so it survives navigating away and back) and is also
  // carried in the URL during the calling flow — merge both so nothing is lost.
  const cookieStore = await cookies();
  const cookieSkip = (cookieStore.get("cp_skip")?.value ?? "").split(",").filter(Boolean);
  const urlSkip = (skip ?? "").split(",").filter(Boolean);
  const skipIds = [...new Set([...urlSkip, ...cookieSkip])];

  // Search by name or number. Pressing enter on a query that matches exactly one of the
  // caller's customers drops straight into the call screen for them; several matches show
  // a pick-list instead.
  const query = (q ?? "").trim();
  const matches = query ? await searchAssignedCustomers(session.userId, query) : [];

  // "focus" (from a follow-up's Call button, or a search hit) pins a specific customer;
  // otherwise the queue picks the next one.
  const focusId = focus ?? (matches.length === 1 ? matches[0].id : undefined);
  const focused = focusId ? await getAssignedCustomer(session.userId, focusId) : null;

  const searchCard = (
    <BentoTile title="Find a customer" glow="sky">
      <form method="get" className="flex flex-wrap items-end gap-3">
        {/* Keeps the session's skip list alive across a search. */}
        {skipIds.length > 0 && <input type="hidden" name="skip" value={skipIds.join(",")} />}
        <label className="w-full text-sm font-medium sm:min-w-[16rem] sm:flex-1">
          Search by name or number
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoComplete="off"
            placeholder="e.g. Priya or 98765 — press enter to call"
            className={`${bentoInputClass} mt-1`}
          />
        </label>
        <button type="submit" className={bentoButtonClass}>
          Search
        </button>
        {query && (
          <Link
            href={skipIds.length > 0 ? `/caller/call?skip=${skipIds.join(",")}` : "/caller/call"}
            className={bentoGhostButtonClass}
          >
            Clear
          </Link>
        )}
      </form>

      {query && matches.length === 0 && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          No open customer of yours matches “{query}”.
        </p>
      )}
      {matches.length > 1 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {matches.map((match) => (
            <li key={match.id}>
              <Link
                href={`/caller/call?focus=${match.id}${skipIds.length > 0 ? `&skip=${skipIds.join(",")}` : ""}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors hover:border-sky-400 hover:bg-sky-500/10 dark:border-neutral-700 dark:hover:border-sky-400"
              >
                <span className="font-semibold">{customerLabel(match)}</span>
                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{match.phone}</span>
                <Badge tone={statusTone(match.status)}>{humanize(match.status)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {query && matches.length === 1 && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Showing {customerLabel(matches[0])} below — ready to call.
        </p>
      )}
    </BentoTile>
  );

  const [queueCount, callsToday, me, lastCall, shouldCall] = await Promise.all([
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
    // Tried today but never reached — callable again without waiting for tomorrow.
    getShouldCallList(session.userId),
  ]);

  // Once the daily target is reached, the queue stops serving fresh leads — only
  // follow-ups/callbacks that are actually due keep coming through.
  const target = me?.dailyTarget ?? 0;
  const targetReached = target > 0 && callsToday >= target;
  const nextInQueue = focused
    ? null
    : await getNextCustomer(session.userId, skipIds, { targetReached });

  const shouldCallCard = shouldCall.length > 0 && !targetReached && (
    <BentoTile
      title={`Should call again (${shouldCall.length})`}
      glow="amber"
      action={
        <Link
          href="/caller/should-call"
          className="text-sm font-bold uppercase tracking-wide underline underline-offset-2"
        >
          See all →
        </Link>
      }
    >
      {/* No answer / busy / switched off from earlier today. "Call" pins the lead on
          this same screen, so the flow is identical to a queued call. */}
      <ul className="space-y-2">
        {shouldCall.slice(0, 5).map((entry) => (
          <li
            key={entry.customerId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
          >
            <span className="min-w-0">
              <span className="font-semibold">{customerLabel(entry)}</span>
              <span className="ml-2 tabular-nums text-neutral-500 dark:text-neutral-400">{entry.phone}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {humanize(entry.lastStatus)} at {formatShortTime(entry.lastTriedAt)}
                {entry.attemptsToday > 1 ? ` · ${entry.attemptsToday} attempts` : ""}
              </span>
            </span>
            <Link
              href={`/caller/call?focus=${entry.customerId}${skipIds.length > 0 ? `&skip=${skipIds.join(",")}` : ""}`}
              className={bentoGhostButtonClass}
            >
              Call
            </Link>
          </li>
        ))}
      </ul>
    </BentoTile>
  );

  const customer = focused ?? nextInQueue;

  // Which set-aside customers still exist — only the count is shown here; full details
  // live on the "View details" page.
  const skippedCustomers =
    skipIds.length > 0
      ? await prisma.customer.findMany({ where: { id: { in: skipIds } }, select: { id: true } })
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
      {/* Just a summary here — the full customer list lives behind "View details". */}
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {skippedInOrder.length} customer{skippedInOrder.length === 1 ? "" : "s"} set aside this session. Open details to
        see them and call again.
      </p>
    </Card>
  );

  if (!customer) {
    return (
      <div className="space-y-3">
        {searchCard}
        {shouldCallCard}
        <Card title={targetReached ? "Daily target reached 🎉" : "Calling screen"}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {targetReached
              ? `You have hit your daily target of ${target} calls. New numbers stop here — only follow-ups and callbacks that fall due will still appear.`
              : skipIds.length > 0
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
            <form action={clearSkips} className="mt-3">
              <button type="submit" className={secondaryButtonClass}>
                Start over
              </button>
            </form>
          )}
        </Card>
        {skippedCard}
      </div>
    );
  }

  const timing = await readCallTiming(customer.id);

  // Tell the caller WHY this number is in front of them — especially useful once the
  // fresh daily queue is exhausted and the screen starts serving scheduled work.
  const pendingFollowUp = customer.followUps[0];
  const isShouldCall = (SHOULD_CALL_ONLY_STATUSES as readonly string[]).includes(customer.status);
  const source = isShouldCall
    ? { label: "Should call", tone: "amber" as const }
    : pendingFollowUp
      ? customer.status === "INTERESTED"
        ? { label: "Follow-up", tone: "green" as const }
        : { label: "Callback", tone: "blue" as const }
      : null;

  const savedBanner = last && (
    <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
      <span>Call saved.</span>
      <Link href="/caller/my-calls" className="font-bold underline underline-offset-2">
        Wrong outcome? Fix it →
      </Link>
    </p>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">Calling screen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {callsToday}/{me?.dailyTarget ?? 0} calls today · {queueCount} in queue
          {skipIds.length > 0 && ` · ${skipIds.length} skipped`}
        </p>
      </div>

      {savedBanner}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* On a phone the call panel comes first (order-1); the read-only info sits below.
            On large screens the info returns to the left column. */}
        <div className="order-2 space-y-3 lg:order-1">
          <Card title="Current customer">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <a
                href={`tel:${customer.phone}`}
                className="text-base font-semibold tabular-nums tracking-wide underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                {customer.phone}
              </a>
              <span className="flex items-center gap-2">
                {source && <Badge tone={source.tone}>{source.label}</Badge>}
                <Badge tone={statusTone(customer.status)}>{humanize(customer.status)}</Badge>
                <span className="text-slate-500 dark:text-slate-400">{humanize(customer.priority)}</span>
              </span>
            </div>
            {source && pendingFollowUp && (
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                {source.label} scheduled for {formatDateTime(pendingFollowUp.dueAt)}
              </p>
            )}
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
                  <span className="text-base font-semibold">{customerLabel(callLead(lastCall))}</span>
                </Row>
                <Row label="Phone">
                  <a
                    href={`tel:${callLead(lastCall).phone}`}
                    className="tabular-nums tracking-wide underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current hover:text-emerald-700 dark:hover:text-emerald-400"
                  >
                    {callLead(lastCall).phone}
                  </a>
                </Row>
                <Row label="Company">{callLead(lastCall).company ?? "—"}</Row>
                <Row label="City">{callLead(lastCall).city ?? "—"}</Row>
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

          {/* The count is the real total, not the three loaded here — the full thread
              lives on the customer's own page. */}
          <Card
            title={`Previous responses (${customer._count.calls})`}
            action={
              customer._count.calls > customer.calls.length ? (
                <Link
                  href={`/caller/customers/${customer.id}`}
                  className="text-sm font-bold uppercase tracking-wide underline underline-offset-2"
                >
                  Full history →
                </Link>
              ) : undefined
            }
          >
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
                      className="bento w-[min(28rem,90vw)] p-5 text-sm"
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

        {/* order-1 on a phone: the panel is the first thing under the header, with
            the search and retry lists below it rather than pushing it off screen. */}
        <div className="order-1 lg:order-2">
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
            focus={focused ? focusId : undefined}
            timing={timing}
            error={error}
            callsToday={callsToday}
            dailyTarget={me?.dailyTarget ?? 0}
          />
        </div>
      </div>

      {searchCard}
      {shouldCallCard}
    </div>
  );
}

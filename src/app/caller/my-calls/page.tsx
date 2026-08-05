import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { updateOwnCall } from "@/app/actions/calls";
import {
  Badge,
  BentoStat,
  BentoTile,
  Row,
  bentoButtonClass,
  bentoGhostButtonClass,
  bentoInputClass,
  statusTone,
} from "@/components/ui";
import {
  CALL_STATUSES,
  COURSES,
  SUCCESS_STATUSES,
  callLead,
  customerLabel,
  formatDuration,
  humanize,
} from "@/lib/labels";
import { formatDateTime, formatShortTime } from "@/lib/datetime";
import { endOfDay, startOfDay } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/** Plenty for a day or a month of one caller's own calls, without server-side paging. */
const PAGE_SIZE = 300;

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a yyyy-mm-dd value from a date input; returns null for junk. */
function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * "My calls" — every call this counsellor has logged, filtered by date. Both dates
 * default to today, so the page opens on what they have done so far this shift; widen
 * From to look further back. Each row can be edited to fix an outcome or note.
 *
 * Laid out as a bento board rather than the admin's stacked cards: the numbers, the
 * range picker and the history read as one glance-able surface.
 */
export default async function MyCalls({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; saved?: string; error?: string; outcome?: string; q?: string }>;
}) {
  const session = await requireCaller();
  const params = await searchParams;

  const today = toInputValue(new Date());
  const fromInput = params.from ?? today;
  const toInput = params.to ?? today;
  const fromDate = parseDate(fromInput);
  const toDate = parseDate(toInput);

  // Free-text search runs over the customer's name/phone and the counsellor's own
  // words, since "the guy who wanted the brochure" is as likely to be in the notes.
  const search = (params.q ?? "").trim();
  const digits = search.replace(/\D/g, "");
  const outcome = params.outcome ?? "";

  const where = {
    callerId: session.userId,
    ...(outcome ? { status: outcome as never } : {}),
    ...(search
      ? {
          OR: [
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            ...(digits ? [{ customerPhone: { contains: digits } }] : []),
            { response: { contains: search, mode: "insensitive" as const } },
            { comments: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(fromDate || toDate
      ? {
          startedAt: {
            ...(fromDate ? { gte: startOfDay(fromDate) } : {}),
            ...(toDate ? { lt: endOfDay(toDate) } : {}),
          },
        }
      : {}),
  };

  const [total, calls] = await Promise.all([
    prisma.call.count({ where }),
    prisma.call.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        duration: true,
        status: true,
        response: true,
        comments: true,
        course: true,
        customer: { select: { id: true, name: true, phone: true, company: true } },
        customerPhone: true,
        customerName: true,
        // Whether this call scheduled a callback, and whether it was kept.
        followUp: { select: { dueAt: true, status: true } },
        // Only the count — the before-values live on the customer's thread page.
        _count: { select: { edits: true } },
      },
    }),
  ]);

  const talkTime = calls.reduce((sum, call) => sum + call.duration, 0);
  const connected = calls.filter((call) => SUCCESS_STATUSES.includes(call.status)).length;
  // Editing posts back here, so the caller returns to the same range they were viewing.
  const back = `/caller/my-calls?from=${encodeURIComponent(fromInput)}&to=${encodeURIComponent(toInput)}${
    outcome ? `&outcome=${encodeURIComponent(outcome)}` : ""
  }${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  const isToday = fromInput === today && toInput === today && !outcome && !search;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold">My calls</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {isToday ? "Today" : `${fromInput} → ${toInput}`}
        </p>
      </div>

      {params.saved && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Call updated.
        </p>
      )}
      {params.error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
          {params.error}
        </p>
      )}

      <div className="bento-grid">
        <BentoStat label="Calls" value={total} span={3} glow="indigo" hint={isToday ? "Logged today" : "In this range"} />
        <BentoStat
          label="Connected"
          value={connected}
          span={3}
          glow="emerald"
          hint={total > 0 ? `${Math.round((connected / total) * 100)}% of calls` : "No calls yet"}
        />
        <BentoStat label="Talk time" value={formatDuration(talkTime)} span={3} glow="violet" hint="Total on the phone" />
        <BentoStat
          label="Avg call"
          value={formatDuration(calls.length ? Math.round(talkTime / calls.length) : 0)}
          span={3}
          glow="sky"
          hint="Per logged call"
        />

        <BentoTile title="Date range" glow="amber" span={12}>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              From
              <input type="date" name="from" defaultValue={fromInput} className={`${bentoInputClass} mt-1`} />
            </label>
            <label className="text-sm font-medium">
              To
              <input type="date" name="to" defaultValue={toInput} className={`${bentoInputClass} mt-1`} />
            </label>
            <label className="text-sm font-medium">
              Outcome
              <select name="outcome" defaultValue={outcome} className={`${bentoInputClass} mt-1`}>
                <option value="">Any outcome</option>
                {CALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[12rem] flex-1 text-sm font-medium">
              Search
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Name, number, or your notes"
                className={`${bentoInputClass} mt-1`}
              />
            </label>
            <button type="submit" className={bentoButtonClass}>
              Apply
            </button>
            {!isToday && (
              <Link href="/caller/my-calls" className={bentoGhostButtonClass}>
                Reset
              </Link>
            )}
            <p className="w-full text-xs text-neutral-500 dark:text-neutral-400">
              Defaults to today. Set From to an earlier date to see your whole history.
            </p>
          </form>
        </BentoTile>

        {/* No `title` here: the tile pads itself to zero so the table can run
            edge-to-edge, and the header below carries its own padding. */}
        <BentoTile glow="indigo" span={12} flush>
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Call history
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {total > calls.length
                ? `Latest ${calls.length} of ${total} — narrow the range for older calls`
                : `${total} call${total === 1 ? "" : "s"}`}
            </span>
          </header>
          {calls.length === 0 ? (
            <p className="p-5 text-sm text-neutral-500 dark:text-neutral-400">
              No calls in this range{isToday ? " yet today" : ""}.
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white/90 text-[11px] uppercase tracking-widest text-neutral-500 backdrop-blur dark:bg-black/80 dark:text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Started</th>
                    <th className="px-3 py-2 font-semibold">Ended</th>
                    <th className="px-3 py-2 font-semibold">Duration</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Outcome</th>
                    <th className="px-3 py-2 font-semibold">Follow-up</th>
                    <th className="px-3 py-2 font-semibold">Response / notes</th>
                    <th className="px-3 py-2 font-semibold">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const lead = callLead(call);
                    return (
                    <tr key={call.id} className="align-top transition-colors hover:bg-indigo-500/5">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(call.startedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-500 dark:text-neutral-400">
                        {formatShortTime(call.endedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDuration(call.duration)}</td>
                      <td className="px-3 py-2">
                        {call.customer ? (
                          <Link
                            href={`/caller/customers/${call.customer.id}`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {customerLabel(lead)}
                          </Link>
                        ) : (
                          <span className="font-medium">{customerLabel(lead)}</span>
                        )}
                        <span className="block text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                          {lead.phone}
                          {lead.company ? ` · ${lead.company}` : ""}
                          {lead.deleted ? " · lead deleted" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                        {call.course && (
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                            {call.course}
                          </span>
                        )}
                        {call._count.edits > 0 && (
                          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                            Edited
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {call.followUp ? (
                          <>
                            <Badge tone={statusTone(call.followUp.status)}>{humanize(call.followUp.status)}</Badge>
                            <span className="mt-1 block text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                              {formatDateTime(call.followUp.dueAt)}
                            </span>
                          </>
                        ) : (
                          <span className="text-neutral-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">
                        {call.response || call.comments ? (
                          <span className="block max-w-[22rem] whitespace-pre-wrap">
                            {[call.response, call.comments].filter(Boolean).join(" — ")}
                          </span>
                        ) : (
                          <span className="text-neutral-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {/* Native HTML popover: the edit form opens with no client JavaScript,
                            matching the rest of the calling flow. */}
                        <button
                          type="button"
                          popoverTarget={`edit-call-${call.id}`}
                          className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700 transition-colors hover:bg-indigo-500/20 dark:text-indigo-200"
                        >
                          Edit
                        </button>

                        <div
                          id={`edit-call-${call.id}`}
                          popover="auto"
                          data-glow="violet"
                          className="bento w-[min(32rem,92vw)] p-5 text-sm text-black dark:text-white"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                              Edit call
                            </h3>
                            <button
                              type="button"
                              popoverTarget={`edit-call-${call.id}`}
                              popoverTargetAction="hide"
                              className="rounded-lg px-2 py-1 text-neutral-500 hover:text-black dark:hover:text-white"
                              aria-label="Close"
                            >
                              ✕
                            </button>
                          </div>

                          <dl className="mb-4 space-y-2">
                            <Row label="Customer">{customerLabel(lead)}</Row>
                            <Row label="Phone">
                              <span className="tabular-nums">{lead.phone}</span>
                            </Row>
                            <Row label="Called">
                              {formatDateTime(call.startedAt)} · {formatDuration(call.duration)}
                            </Row>
                          </dl>

                          <form action={updateOwnCall} className="space-y-3 text-left">
                            <input type="hidden" name="callId" value={call.id} />
                            <input type="hidden" name="back" value={back} />

                            {/* Same status-block/course-field pairing as the calling panel, so
                                the course only shows for an interested lead. */}
                            <div className="status-block space-y-3">
                              <label className="block text-sm font-medium">
                                Call status
                                <select
                                  name="status"
                                  required
                                  defaultValue={call.status}
                                  className={`${bentoInputClass} mt-1`}
                                >
                                  {CALL_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {humanize(status)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="course-field text-sm font-medium">
                                Course interested in
                                <select
                                  name="course"
                                  defaultValue={call.course ?? ""}
                                  className={`${bentoInputClass} mt-1`}
                                >
                                  <option value="">— Select course —</option>
                                  {COURSES.map((course) => (
                                    <option key={course} value={course}>
                                      {course}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <label className="block text-sm font-medium">
                              Response type
                              <input
                                name="response"
                                defaultValue={call.response ?? ""}
                                className={`${bentoInputClass} mt-1`}
                              />
                            </label>
                            <label className="block text-sm font-medium">
                              Comments
                              <textarea
                                name="comments"
                                rows={3}
                                defaultValue={call.comments ?? ""}
                                className={`${bentoInputClass} mt-1`}
                              />
                            </label>

                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              Call timings cannot be changed — they are stamped when you start and end the call.
                            </p>
                            <button type="submit" className={`${bentoButtonClass} w-full`}>
                              Save changes
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BentoTile>
      </div>
    </div>
  );
}

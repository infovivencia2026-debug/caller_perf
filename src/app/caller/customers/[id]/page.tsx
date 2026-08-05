import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, BentoStat, BentoTile, Row, bentoButtonClass, statusTone } from "@/components/ui";
import { SUCCESS_STATUSES, customerLabel, formatDuration, humanize } from "@/lib/labels";
import { formatDateTime, formatShortTime } from "@/lib/datetime";
import { parseTags } from "@/lib/tags";

export const dynamic = "force-dynamic";

/**
 * The whole arc of one lead: every call ever made to them, every follow-up scheduled
 * off those calls, and every correction made to a logged outcome — merged into a single
 * timeline, newest first. The calling screen only ever shows the last three responses,
 * so this is where "what has actually happened with this person" gets answered.
 *
 * Scoped to the counsellor's own leads.
 */
export default async function CustomerThread({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCaller();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, assignedToId: session.userId },
    include: {
      calls: {
        orderBy: { startedAt: "desc" },
        include: {
          caller: { select: { name: true } },
          followUp: true,
          edits: { orderBy: { createdAt: "desc" }, include: { editor: { select: { name: true } } } },
        },
      },
      followUps: { orderBy: { dueAt: "desc" }, include: { caller: { select: { name: true } } } },
    },
  });

  // Either it does not exist or it belongs to someone else — same answer either way,
  // so one counsellor cannot probe for another's leads.
  if (!customer) notFound();

  const talkTime = customer.calls.reduce((sum, call) => sum + call.duration, 0);
  const connected = customer.calls.filter((call) => SUCCESS_STATUSES.includes(call.status)).length;
  const firstCall = customer.calls.at(-1);
  const pending = customer.followUps.filter((f) => f.status === "PENDING");

  // Follow-ups created off a call are shown inside that call's entry; anything else
  // (rescheduled by an admin, say) gets its own row on the timeline.
  const callIdsWithFollowUp = new Set(customer.calls.map((call) => call.followUp?.id).filter(Boolean));
  const looseFollowUps = customer.followUps.filter((f) => !callIdsWithFollowUp.has(f.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{customerLabel(customer)}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
<span className="tabular-nums">{customer.phone}</span>
            {customer.company ? ` · ${customer.company}` : ""}
            {customer.city ? ` · ${customer.city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(customer.status)}>{humanize(customer.status)}</Badge>
          <Link href={`/caller/call?focus=${customer.id}`} className={bentoButtonClass}>
            Call now
          </Link>
        </div>
      </div>

      <div className="bento-grid">
        <BentoStat label="Calls" value={customer.calls.length} span={3} glow="indigo" />
        <BentoStat
          label="Connected"
          value={connected}
          span={3}
          glow="emerald"
          hint={customer.calls.length ? `${Math.round((connected / customer.calls.length) * 100)}% of calls` : undefined}
        />
        <BentoStat label="Talk time" value={formatDuration(talkTime)} span={3} glow="violet" />
        <BentoStat
          label="First contacted"
          value={firstCall ? formatDateTime(firstCall.startedAt).split(",")[0] : "—"}
          span={3}
          glow="sky"
          hint={pending.length > 0 ? `${pending.length} follow-up pending` : "No follow-up pending"}
        />

        <BentoTile title="Lead details" glow="amber" span={5}>
          <dl className="space-y-2 text-sm">
            <Row label="Name">{customer.name || "—"}</Row>
            <Row label="Phone">
              <span className="tabular-nums">{customer.phone}</span>
            </Row>
            <Row label="Company">{customer.company ?? "—"}</Row>
            <Row label="City">{customer.city ?? "—"}</Row>
            <Row label="Email">{customer.email ?? "—"}</Row>
            <Row label="Priority">{humanize(customer.priority)}</Row>
            <Row label="Added">{formatDateTime(customer.createdAt)}</Row>
            {parseTags(customer.tags).length > 0 && (
              <Row label="Tags">
                <span className="space-x-1">
                  {parseTags(customer.tags).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </span>
              </Row>
            )}
            {customer.notes && (
              <Row label="Notes">
                <span className="whitespace-pre-wrap">{customer.notes}</span>
              </Row>
            )}
          </dl>
        </BentoTile>

        <BentoTile title="Timeline" glow="indigo" span={7}>
          {customer.calls.length === 0 && looseFollowUps.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Nothing yet — this lead has never been called.
            </p>
          ) : (
            <ol className="space-y-3">
              {looseFollowUps.map((followUp) => (
                <li
                  key={followUp.id}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(followUp.status)}>{humanize(followUp.status)}</Badge>
                    <span className="font-medium">Follow-up</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      due {formatDateTime(followUp.dueAt)} · {followUp.caller.name}
                    </span>
                  </div>
                  {followUp.notes && <p className="mt-1 whitespace-pre-wrap">{followUp.notes}</p>}
                </li>
              ))}

              {customer.calls.map((call) => (
                <li key={call.id} className="rounded-lg border border-neutral-200 px-3 py-3 text-sm dark:border-neutral-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(call.startedAt)} · {formatDuration(call.duration)} · {call.caller.name}
                    </span>
                    {call.edits.length > 0 && (
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                        Edited
                      </span>
                    )}
                  </div>

                  {call.course && (
                    <p className="mt-1 text-neutral-600 dark:text-neutral-300">Course: {call.course}</p>
                  )}
                  {call.response && <p className="mt-1">{call.response}</p>}
                  {call.comments && (
                    <p className="mt-1 whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">{call.comments}</p>
                  )}

                  {/* The follow-up this call scheduled, and whether it was kept. */}
                  {call.followUp && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-2 text-xs dark:border-neutral-800">
                      <Badge tone={statusTone(call.followUp.status)}>{humanize(call.followUp.status)}</Badge>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        Follow-up due {formatDateTime(call.followUp.dueAt)}
                        {call.followUp.completedAt ? ` · closed ${formatShortTime(call.followUp.completedAt)}` : ""}
                      </span>
                    </p>
                  )}

                  {/* What this call said before it was corrected. Without this an edited
                      outcome is indistinguishable from an original one. */}
                  {call.edits.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                      {call.edits.map((edit) => (
                        <li key={edit.id}>
                          {formatDateTime(edit.createdAt)} — {edit.editor?.name ?? "Someone"} changed the outcome from{" "}
                          <span className="font-semibold">{humanize(edit.fromStatus)}</span> to{" "}
                          <span className="font-semibold">{humanize(edit.toStatus)}</span>
                          {edit.fromResponse !== edit.toResponse && (
                            <>
                              ; response was “{edit.fromResponse || "empty"}”
                            </>
                          )}
                          {edit.fromComments !== edit.toComments && <>; comments were edited</>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </BentoTile>
      </div>
    </div>
  );
}

import {
  endCall,
  resetCall,
  saveCall,
  saveCustomerDetails,
  skipCustomer,
  startCall,
} from "@/app/actions/calls";
import { BentoTile, bentoGhostButtonClass, bentoInputClass } from "@/components/ui";
import type { CallTiming } from "@/lib/call-timer";
import { currentClock, elapsedSecondsSince, formatClock } from "@/lib/datetime";
import { CALL_STATUSES, COURSES, PRIORITIES, formatDuration, humanize, shortStatus } from "@/lib/labels";
import { CallShortcuts, DialAndStart, FollowUpPresets, SubmitButton } from "./call-controls";

type CustomerDetails = {
  name: string;
  company: string | null;
  city: string | null;
  email: string | null;
  notes: string | null;
};

/**
 * The four outcomes that cover most calls. They get big tap targets at the top of the
 * outcome picker (and keys 1–4 on a desktop); the rest follow in the same grid.
 */
const COMMON_STATUSES = ["NO_ANSWER", "BUSY", "NOT_INTERESTED", "INTERESTED"];
const ORDERED_STATUSES = [...COMMON_STATUSES, ...CALL_STATUSES.filter((s) => !COMMON_STATUSES.includes(s))];

/**
 * The calling panel, built for a phone held in one hand: one green Call button that
 * both opens the dialer and starts the clock, outcomes as tappable chips rather than a
 * dropdown, and everything the counsellor rarely touches folded away.
 *
 * Still plain HTML underneath — every control is a submit button on one form, so the
 * panel keeps working if the client bundle never loads. The client components only add
 * the dialer hand-off, pending labels, follow-up presets and keyboard shortcuts.
 */
export default function CallPanel({
  customerId,
  customerName,
  phone,
  customer,
  skipped,
  focus,
  timing,
  error,
  callsToday,
  dailyTarget,
}: {
  customerId: string;
  customerName: string;
  phone: string;
  customer: CustomerDetails;
  skipped: string[];
  focus?: string;
  timing: CallTiming | null;
  error?: string;
  callsToday: number;
  dailyTarget: number;
}) {
  const skippedValue = skipped.join(",");
  const startedAt = timing ? new Date(timing.startedAt) : null;
  const endedAt = timing?.endedAt ? new Date(timing.endedAt) : null;
  const ended = Boolean(startedAt && endedAt);
  const duration =
    startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : 0;
  const draft = timing?.draft ?? {};
  // Elapsed at render time. The inline script in the root layout keeps it ticking, but
  // this value is what shows if scripts never run — so the panel is never blank.
  const elapsed = ended ? duration : startedAt ? elapsedSecondsSince(startedAt) : 0;
  const progress = dailyTarget > 0 ? Math.min(100, Math.round((callsToday / dailyTarget) * 100)) : 0;

  return (
    <BentoTile glow="emerald" flush className="overflow-visible">
      <CallShortcuts />

      {/* Everything needed to place the call sits in the first screenful: who, the
          number, the clock and the green button. */}
      <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-base font-bold">{customerName}</p>
        <a
          href={`tel:${phone}`}
          className="text-3xl font-extrabold tabular-nums tracking-tight underline underline-offset-4"
        >
          {phone}
        </a>

        {/* Daily target, as a bar rather than a line of small print. */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {callsToday} of {dailyTarget} calls today
            </span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* One form, several submit buttons. Start/End/Reset/Skip set formNoValidate so
          the required outcome does not block them mid-call. */}
      <form action={saveCall} className="space-y-3 p-4">
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="skipped" value={skippedValue} />
        {focus && <input type="hidden" name="focus" value={focus} />}

        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-3xl font-semibold tabular-nums">
            {startedAt ? (
              <span id="call-elapsed" data-started-at={ended ? undefined : timing?.startedAt}>
                {formatDuration(elapsed)}
              </span>
            ) : (
              <span className="text-neutral-400 dark:text-neutral-600">Not started</span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {!startedAt && "Tap Call — it dials and starts the timer"}
            {startedAt && !ended && (
              <>
                Now <span id="call-now" className="tabular-nums">{currentClock()}</span>
              </>
            )}
            {endedAt && `Ended ${formatClock(endedAt)}`}
          </p>

          <div className="mt-3 space-y-2">
            {!startedAt && (
              <span data-shortcut="start" className="block">
                <DialAndStart phone={phone}>Call {phone}</DialAndStart>
              </span>
            )}

            {startedAt && !ended && (
              <span data-shortcut="end" className="block">
                <SubmitButton
                  formAction={endCall}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-rose-600/60 bg-gradient-to-b from-rose-500 to-rose-600 px-4 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),0_2px_4px_0_rgb(15_15_30/0.2)] transition-all active:translate-y-px"
                  pendingLabel="Ending…"
                >
                  End call
                </SubmitButton>
              </span>
            )}

            <div className="flex flex-wrap gap-2">
              {startedAt && (
                <SubmitButton formAction={resetCall} className={bentoGhostButtonClass} pendingLabel="…">
                  Reset timer
                </SubmitButton>
              )}
              {startedAt && (
                <a href={`tel:${phone}`} className={bentoGhostButtonClass}>
                  Redial
                </a>
              )}
            </div>
          </div>

          {/* Forgetting to press Call used to make the conversation unloggable — the
              save is refused without both stamps. This is the way out: state the
              length and log it. */}
          {!ended && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                Called without the timer?
              </summary>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Enter roughly how long you spoke and save as normal. The call is recorded as
                manually timed.
              </p>
              <label className="mt-2 block text-sm font-medium">
                Minutes on the call
                <input
                  type="number"
                  name="manualMinutes"
                  min={0}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 4"
                  className={`${bentoInputClass} mt-1`}
                />
              </label>
            </details>
          )}
        </div>

        {/* Outcome as chips: on a phone the old dropdown was a scroll wheel on every
            single call. status-block lets the CSS in globals.css reveal the course
            picker only when Interested is chosen, with no JavaScript. */}
        <div className="status-block">
          <p className="text-sm font-medium">Call outcome</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {ORDERED_STATUSES.map((status, index) => (
              <label
                key={status}
                className="relative flex cursor-pointer items-center justify-center rounded-lg border border-neutral-300 px-2 py-3 text-center text-sm font-semibold transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-500/15 has-[:checked]:text-indigo-700 dark:border-neutral-700 dark:has-[:checked]:text-indigo-200"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  required
                  defaultChecked={draft.status === status}
                  data-outcome={index < 4 ? String(index + 1) : undefined}
                  className="sr-only"
                />
                {shortStatus(status)}
              </label>
            ))}
          </div>

          <label className="course-field mt-3 text-sm font-medium">
            Course interested in
            <select name="course" defaultValue={draft.course ?? ""} className={`${bentoInputClass} mt-1`}>
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
          Response
          <input
            name="response"
            defaultValue={draft.response ?? ""}
            placeholder="e.g. Asked for a brochure"
            className={`${bentoInputClass} mt-1`}
          />
        </label>

        <label className="block text-sm font-medium">
          Comments
          <textarea name="comments" rows={2} defaultValue={draft.comments ?? ""} className={`${bentoInputClass} mt-1`} />
        </label>

        <div>
          <label className="block text-sm font-medium">
            Follow-up (optional)
            <input
              type="datetime-local"
              name="followUpDate"
              defaultValue={draft.followUpDate ?? ""}
              className={`${bentoInputClass} mt-1`}
            />
          </label>
          <FollowUpPresets />
        </div>

        {/* Six fields the counsellor mostly does not touch — folded away so the panel
            stays short, but still part of this form, so they save with the call. */}
        <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <summary className="cursor-pointer text-sm font-semibold">Lead details &amp; priority</summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-medium">
              Name
              <input name="name" defaultValue={draft.name ?? customer.name} className={`${bentoInputClass} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-medium">
                Company
                <input
                  name="company"
                  defaultValue={draft.company ?? customer.company ?? ""}
                  className={`${bentoInputClass} mt-1`}
                />
              </label>
              <label className="block text-sm font-medium">
                City
                <input
                  name="city"
                  defaultValue={draft.city ?? customer.city ?? ""}
                  className={`${bentoInputClass} mt-1`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                name="email"
                defaultValue={draft.email ?? customer.email ?? ""}
                className={`${bentoInputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea
                name="notes"
                rows={2}
                defaultValue={draft.notes ?? customer.notes ?? ""}
                className={`${bentoInputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium">
              Priority
              {/* Blank keeps the customer's own priority — see saveSchema. */}
              <select name="priority" defaultValue={draft.priority ?? ""} className={`${bentoInputClass} mt-1`}>
                <option value="">Leave unchanged</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    Set to {humanize(priority)}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton formAction={saveCustomerDetails} className={bentoGhostButtonClass} pendingLabel="Saving…">
              Save details only
            </SubmitButton>
          </div>
        </details>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        {/* The save bar sticks to the bottom of the viewport on a phone, so it is
            reachable with a thumb no matter how far down the form you are. */}
        <div className="sticky bottom-0 -mx-4 mt-1 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-black/85">
          <span data-shortcut="save" className="block">
            <SubmitButton
              noValidate={false}
              className="inline-flex w-full items-center justify-center rounded-lg border border-indigo-500/50 bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),0_2px_4px_0_rgb(15_15_30/0.2)] transition-all active:translate-y-px disabled:opacity-50"
              pendingLabel="Saving…"
            >
              Save &amp; next
            </SubmitButton>
          </span>
          <span data-shortcut="skip" className="mt-2 block">
            <SubmitButton formAction={skipCustomer} className={`${bentoGhostButtonClass} w-full`} pendingLabel="…">
              Skip
            </SubmitButton>
          </span>
        </div>
      </form>
    </BentoTile>
  );
}

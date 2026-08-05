import {
  endCall,
  resetCall,
  saveCall,
  saveCustomerDetails,
  skipCustomer,
  startCall,
} from "@/app/actions/calls";
import { Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { CallTiming } from "@/lib/call-timer";
import { currentClock, elapsedSecondsSince, formatClock } from "@/lib/datetime";
import { CALL_STATUSES, COURSES, PRIORITIES, formatDuration, humanize } from "@/lib/labels";

type CustomerDetails = {
  name: string;
  company: string | null;
  city: string | null;
  email: string | null;
  notes: string | null;
};

/**
 * Plain-HTML calling panel: no client JavaScript at all. Every button is a submit
 * button on one form, distinguished by `formAction`, so the server stamps the call
 * clock and the typed values survive each post. The trade-off versus the old React
 * timer is that elapsed time does not tick live — it appears once the call is ended.
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
}: {
  customerId: string;
  customerName: string;
  phone: string;
  customer: CustomerDetails;
  skipped: string[];
  focus?: string;
  timing: CallTiming | null;
  error?: string;
}) {
  const skippedValue = skipped.join(",");
  const startedAt = timing ? new Date(timing.startedAt) : null;
  const endedAt = timing?.endedAt ? new Date(timing.endedAt) : null;
  const ended = Boolean(startedAt && endedAt);
  const duration =
    startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : 0;
  const draft = timing?.draft ?? {};
  // Elapsed at render time. The inline script below keeps it ticking, but this
  // value is what shows if scripts never run — so the panel is never blank.
  const elapsed = ended ? duration : startedAt ? elapsedSecondsSince(startedAt) : 0;

  return (
    <Card title="Log this call">
      {/* Name + big tappable phone up top, so on a phone everything needed to make the
          call and log it is in one place without scrolling. */}
      <div className="mb-4 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <p className="text-base font-bold">{customerName}</p>
        <a href={`tel:${phone}`} className="text-3xl font-extrabold tabular-nums tracking-tight underline underline-offset-4">
          {phone}
        </a>
      </div>
      {/* One form, several submit buttons. Start/End/Reset/Skip set formNoValidate so
          the required status field does not block them mid-call. */}
      <form action={saveCall} className="space-y-3">
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="skipped" value={skippedValue} />
        {focus && <input type="hidden" name="focus" value={focus} />}

        <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dial on your phone, then track the call here
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {startedAt ? (
              <span id="call-elapsed" data-started-at={ended ? undefined : timing?.startedAt}>
                {formatDuration(elapsed)}
              </span>
            ) : (
              "Not started"
            )}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {!startedAt && "Press Start call when the customer picks up"}
            {/* While the call is live, show the wall clock ticking rather than when it began. */}
            {startedAt && !ended && (
              <>
                Now <span id="call-now" className="tabular-nums">{currentClock()}</span>
              </>
            )}
            {endedAt && `Ended ${formatClock(endedAt)}`}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              formAction={startCall}
              formNoValidate
              className={buttonClass}
              disabled={Boolean(startedAt)}
            >
              Start call
            </button>
            <button
              type="submit"
              formAction={endCall}
              formNoValidate
              className={secondaryButtonClass}
              disabled={!startedAt || ended}
            >
              End call
            </button>
            <a href={`tel:${phone}`} className={secondaryButtonClass}>
              Dial {phone}
            </a>
            {startedAt && (
              <button type="submit" formAction={resetCall} formNoValidate className={secondaryButtonClass}>
                Reset timer
              </button>
            )}
          </div>
        </div>

        {/* Editable lead details. These are part of THIS form, so saving the call (or
            "Save details") persists them; the draft cookie keeps edits across Start/End. */}
        <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Lead details — edit and they save with the call
          </p>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Name
              <input name="name" defaultValue={draft.name ?? customer.name} className={`${inputClass} mt-1`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Company
                <input
                  name="company"
                  defaultValue={draft.company ?? customer.company ?? ""}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-sm font-medium">
                City
                <input
                  name="city"
                  defaultValue={draft.city ?? customer.city ?? ""}
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                name="email"
                defaultValue={draft.email ?? customer.email ?? ""}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea
                name="notes"
                rows={2}
                defaultValue={draft.notes ?? customer.notes ?? ""}
                className={`${inputClass} mt-1`}
              />
            </label>
            <button type="submit" formAction={saveCustomerDetails} formNoValidate className={secondaryButtonClass}>
              Save details only
            </button>
          </div>
        </div>

        {/* status-block groups the outcome with the course picker so a pure-CSS :has()
            rule (in globals.css) can reveal the course only when "Interested" is chosen. */}
        <div className="status-block space-y-3">
          <label className="block text-sm font-medium">
            Call status
            <select name="status" required defaultValue={draft.status ?? ""} className={`${inputClass} mt-1`}>
              <option value="" disabled>
                Select an outcome
              </option>
              {CALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="course-field text-sm font-medium">
            Course interested in
            <select name="course" defaultValue={draft.course ?? ""} className={`${inputClass} mt-1`}>
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
            defaultValue={draft.response ?? ""}
            placeholder="e.g. Asked for a brochure"
            className={`${inputClass} mt-1`}
          />
        </label>

        <label className="block text-sm font-medium">
          Comments
          <textarea name="comments" rows={4} defaultValue={draft.comments ?? ""} className={`${inputClass} mt-1`} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Follow-up date (optional)
            <input
              type="datetime-local"
              name="followUpDate"
              defaultValue={draft.followUpDate ?? ""}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium">
            Priority
            {/* Starts at Medium rather than inheriting the customer's priority. The
                blank-valued default is what keeps that from silently demoting a HIGH
                customer: it behaves as Medium for the follow-up but leaves the customer
                record alone. Picking any option below is treated as a deliberate change. */}
            <select name="priority" defaultValue={draft.priority ?? ""} className={`${inputClass} mt-1`}>
              <option value="">Medium — leave customer unchanged</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  Set customer to {humanize(priority)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!ended && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Start and end the call to record its duration before saving.
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={!ended} className={`${buttonClass} w-full`}>
          Save response &amp; next customer
        </button>

        <button type="submit" formAction={skipCustomer} formNoValidate className={`${secondaryButtonClass} w-full`}>
          Skip {customerName}
        </button>
      </form>
    </Card>
  );
}

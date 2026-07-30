"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveCall, skipCustomer, type SaveCallState } from "@/app/actions/calls";
import { Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { CALL_STATUSES, PRIORITIES, formatDuration, humanize } from "@/lib/labels";

/**
 * Times the call locally: "Start call" stamps the start, "End call" stamps the end,
 * and the duration is derived from the two so the caller never types it.
 */
export default function CallPanel({
  customerId,
  customerName,
  phone,
  defaultPriority,
  skipped,
}: {
  customerId: string;
  customerName: string;
  phone: string;
  defaultPriority: string;
  skipped: string[];
}) {
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [state, formAction, pending] = useActionState<SaveCallState, FormData>(saveCall, {});
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt && !endedAt) {
      tick.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [startedAt, endedAt]);

  const ended = Boolean(startedAt && endedAt);

  return (
    <Card title="Log this call">
      <div className="space-y-4">
        <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dial on your phone, then track the call here
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {formatDuration(endedAt && startedAt ? Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000) : elapsed)}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {startedAt ? `Started ${startedAt.toLocaleTimeString()}` : "Not started"}
            {endedAt && ` · Ended ${endedAt.toLocaleTimeString()}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={Boolean(startedAt)}
              onClick={() => {
                setStartedAt(new Date());
                setEndedAt(null);
                setElapsed(0);
              }}
            >
              Start call
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={!startedAt || Boolean(endedAt)}
              onClick={() => setEndedAt(new Date())}
            >
              End call
            </button>
            <a href={`tel:${phone}`} className={secondaryButtonClass}>
              Dial {phone}
            </a>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="startedAt" value={startedAt?.toISOString() ?? ""} />
          <input type="hidden" name="endedAt" value={endedAt?.toISOString() ?? ""} />

          <label className="block text-sm font-medium">
            Call status
            <select name="status" required defaultValue="" className={`${inputClass} mt-1`}>
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

          <label className="block text-sm font-medium">
            Response type
            <input
              name="response"
              placeholder="e.g. Asked for a brochure"
              className={`${inputClass} mt-1`}
            />
          </label>

          <label className="block text-sm font-medium">
            Comments
            <textarea name="comments" rows={4} className={`${inputClass} mt-1`} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Follow-up date (optional)
              <input type="datetime-local" name="followUpDate" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-sm font-medium">
              Priority
              <select name="priority" defaultValue={defaultPriority} className={`${inputClass} mt-1`}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {humanize(priority)}
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
          {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

          <button type="submit" disabled={pending || !ended} className={`${buttonClass} w-full`}>
            {pending ? "Saving…" : "Save response & next customer"}
          </button>
        </form>

        <form action={skipCustomer}>
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="skipped" value={skipped.join(",")} />
          <button type="submit" className={`${secondaryButtonClass} w-full`}>
            Skip {customerName}
          </button>
        </form>
      </div>
    </Card>
  );
}

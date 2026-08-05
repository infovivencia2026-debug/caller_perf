"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Progressive enhancement for the calling panel. Every control here is a plain submit
 * button underneath, so the panel still works with JavaScript off — the client bits
 * only add the dialer hand-off, pending states, presets and shortcuts.
 */

/**
 * Starts the call clock. Deliberately does NOT open the dialer: counsellors dial on
 * the handset themselves, and a tel: navigation mid-form was one more thing to go
 * wrong. This screen only ever records when the call started and ended.
 */
export function StartCallButton({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formNoValidate
      disabled={disabled || pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/60 bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),0_2px_4px_0_rgb(15_15_30/0.2),0_10px_20px_-8px_rgb(16_185_129/0.8)] transition-all active:translate-y-px active:shadow-[inset_0_2px_4px_0_rgb(15_15_30/0.3)] disabled:opacity-50 disabled:pointer-events-none"
    >
      {pending ? "Starting…" : children}
    </button>
  );
}

/** Any submit button, with a pending label so a slow network doesn't look like a dead tap. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  formAction,
  disabled,
  noValidate = true,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
  noValidate?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate={noValidate}
      disabled={disabled || pending}
      className={className}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * Fills the follow-up field from a chip. Picking "tomorrow morning" out of a
 * datetime-local input is half a dozen taps on a phone; this is one.
 */
export function FollowUpPresets() {
  const set = (compute: (now: Date) => Date) => {
    const input = document.querySelector<HTMLInputElement>('input[name="followUpDate"]');
    if (!input) return;
    const when = compute(new Date());
    // datetime-local wants local time with no zone suffix.
    const pad = (n: number) => String(n).padStart(2, "0");
    input.value = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(
      when.getHours(),
    )}:${pad(when.getMinutes())}`;
  };

  const chip =
    "rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition-colors active:bg-indigo-500/15 dark:border-neutral-700";

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        className={chip}
        onClick={() =>
          set((now) => new Date(now.getTime() + 2 * 60 * 60 * 1000))
        }
      >
        In 2 hours
      </button>
      <button
        type="button"
        className={chip}
        onClick={() =>
          set((now) => {
            const d = new Date(now);
            d.setDate(d.getDate() + 1);
            d.setHours(10, 0, 0, 0);
            return d;
          })
        }
      >
        Tomorrow 10am
      </button>
      <button
        type="button"
        className={chip}
        onClick={() =>
          set((now) => {
            const d = new Date(now);
            d.setDate(d.getDate() + 1);
            d.setHours(17, 0, 0, 0);
            return d;
          })
        }
      >
        Tomorrow 5pm
      </button>
      <button
        type="button"
        className={chip}
        onClick={() =>
          set((now) => {
            const d = new Date(now);
            d.setDate(d.getDate() + 7);
            d.setHours(10, 0, 0, 0);
            return d;
          })
        }
      >
        Next week
      </button>
    </div>
  );
}

/**
 * Desktop shortcuts for anyone doing a hundred calls a day: s starts, e ends, 1–4 pick
 * the common outcomes, Ctrl/Cmd+Enter saves. Ignored while typing in a field, and on
 * touch devices nobody ever sees them.
 */
export function CallShortcuts() {
  const shown = useRef(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        document.querySelector<HTMLButtonElement>("[data-shortcut='save']")?.click();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      const byKey: Record<string, string> = {
        s: "[data-shortcut='start']",
        e: "[data-shortcut='end']",
        k: "[data-shortcut='skip']",
      };
      const selector = byKey[event.key.toLowerCase()];
      if (selector) {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          event.preventDefault();
          el.click();
        }
        return;
      }

      // 1–4 select the four outcomes a counsellor uses most.
      if (/^[1-4]$/.test(event.key)) {
        const chip = document.querySelector<HTMLInputElement>(`[data-outcome='${event.key}']`);
        if (chip) {
          event.preventDefault();
          chip.checked = true;
          chip.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }

    document.addEventListener("keydown", onKey);
    shown.current = true;
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

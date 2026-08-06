"use client";

import { deleteMatchingCustomers } from "@/app/actions/customers";

/**
 * Deletes all customers matching the current filters. Destructive, so it confirms with
 * the exact count first. The confirm is the only client JS; without it the button still
 * posts (the server does the delete) — the confirmation is a guard, not the mechanism.
 */
export function DeleteMatchingButton({
  count,
  filtered,
  filters,
}: {
  count: number;
  filtered: boolean;
  filters: { q?: string; status?: string; caller?: string; priority?: string; list?: string };
}) {
  return (
    <form
      action={deleteMatchingCustomers}
      onSubmit={(event) => {
        const scope = filtered ? `${count} matching customer(s)` : `ALL ${count} customer(s)`;
        if (!confirm(`Delete ${scope}? Their follow-ups go too, and this cannot be undone.`)) {
          event.preventDefault();
          return;
        }
        // Wiping the whole customer base needs the words typed out. The server
        // refuses an unfiltered delete without them, so this is the prompt for it.
        if (!filtered) {
          const typed = prompt(`This deletes EVERY customer (${count}). Type DELETE ALL to confirm.`);
          if (typed !== "DELETE ALL") {
            event.preventDefault();
            return;
          }
          const field = event.currentTarget.querySelector<HTMLInputElement>('input[name="confirmAll"]');
          if (field) field.value = typed;
        }
      }}
    >
      <input type="hidden" name="confirmAll" value="" />
      <input type="hidden" name="list" value={filters.list ?? ""} />
      <input type="hidden" name="q" value={filters.q ?? ""} />
      <input type="hidden" name="status" value={filters.status ?? ""} />
      <input type="hidden" name="caller" value={filters.caller ?? ""} />
      <input type="hidden" name="priority" value={filters.priority ?? ""} />
      <button
        type="submit"
        disabled={count === 0}
        className="inline-flex items-center justify-center rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Delete {count} {filtered ? "matching" : "(all)"}
      </button>
    </form>
  );
}

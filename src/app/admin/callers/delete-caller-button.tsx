"use client";

import { deleteCaller } from "@/app/actions/callers";

/**
 * Deleting a counsellor removes them from the roster and disables their login, but keeps
 * their call history in the database (still visible in the Call log and reports). This
 * confirms first; the confirm is the only client JavaScript — the delete is a plain form
 * post, so it still works without it.
 */
export function DeleteCallerButton({ callerId, name }: { callerId: string; name: string }) {
  return (
    <form
      action={deleteCaller}
      onSubmit={(event) => {
        if (
          !confirm(
            `Delete ${name}? They are removed from the list and can no longer sign in, and their customers go back to the unassigned pool. Their call history is kept and stays visible in the Call log.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="callerId" value={callerId} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Delete
      </button>
    </form>
  );
}

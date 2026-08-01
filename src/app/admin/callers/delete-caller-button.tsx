"use client";

import { deleteCaller } from "@/app/actions/callers";

/**
 * Deleting a telecaller is destructive (removes their call history), so this confirms
 * first. The confirm is the only client JavaScript; the delete itself is a plain form
 * post, so it still works without it.
 */
export function DeleteCallerButton({ callerId, name }: { callerId: string; name: string }) {
  return (
    <form
      action={deleteCaller}
      onSubmit={(event) => {
        if (
          !confirm(
            `Delete ${name}? Their assigned customers become unassigned and their call history is removed. This cannot be undone.`,
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

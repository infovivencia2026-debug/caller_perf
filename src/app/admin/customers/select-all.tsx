"use client";

/**
 * Header checkbox that ticks/unticks every customer checkbox in the same form. Kept as a
 * tiny client island so the rest of the customers page stays a server component.
 */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all customers on this page"
      className="h-4 w-4 cursor-pointer accent-indigo-500"
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        form
          ?.querySelectorAll<HTMLInputElement>('input[name="customerIds"]')
          .forEach((box) => {
            box.checked = e.currentTarget.checked;
          });
      }}
    />
  );
}

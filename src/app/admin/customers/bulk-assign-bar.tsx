"use client";

import { useState, type ReactNode } from "react";
import { bulkAssign } from "@/app/actions/customers";
import { Card, buttonClass, inputClass } from "@/components/ui";

/** Wraps the customer table in one form so checked rows can be bulk-assigned. */
export default function BulkAssignBar({
  callers,
  children,
}: {
  callers: { id: string; name: string }[];
  children: ReactNode;
}) {
  const [count, setCount] = useState(0);

  return (
    <form
      action={bulkAssign}
      onChange={(event) => {
        const form = event.currentTarget;
        setCount(form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length);
      }}
    >
      <Card
        title="Bulk assignment"
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{count} selected</span>
            <select name="assignedToId" className={`${inputClass} w-auto`} defaultValue="">
              <option value="">Unassign</option>
              {callers.map((caller) => (
                <option key={caller.id} value={caller.id}>
                  {caller.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={count === 0} className={buttonClass}>
              Assign
            </button>
          </div>
        }
      >
        {children}
      </Card>
    </form>
  );
}

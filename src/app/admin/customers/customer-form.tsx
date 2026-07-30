"use client";

import { useActionState } from "react";
import { createCustomer, updateCustomer, type CustomerFormState } from "@/app/actions/customers";
import { buttonClass, inputClass } from "@/components/ui";
import { CUSTOMER_STATUSES, PRIORITIES, humanize } from "@/lib/labels";

export type CustomerValues = {
  id?: string;
  name: string;
  phone: string;
  company: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  status: string;
  priority: string;
  tags: string[];
  assignedToId: string | null;
};

export default function CustomerForm({
  customer,
  callers,
}: {
  customer?: CustomerValues;
  callers: { id: string; name: string }[];
}) {
  const action = customer?.id ? updateCustomer : createCustomer;
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {customer?.id && <input type="hidden" name="id" value={customer.id} />}

      <Field label="Name" name="name" defaultValue={customer?.name} required />
      <Field label="Phone number" name="phone" defaultValue={customer?.phone} required />
      <Field label="Company" name="company" defaultValue={customer?.company ?? ""} />
      <Field label="Email (optional)" name="email" type="email" defaultValue={customer?.email ?? ""} />
      <Field label="City" name="city" defaultValue={customer?.city ?? ""} />
      <Field label="Tags (comma separated)" name="tags" defaultValue={customer?.tags.join(", ") ?? ""} />

      <label className="text-sm font-medium">
        Status
        <select name="status" defaultValue={customer?.status ?? "NEW"} className={`${inputClass} mt-1`}>
          {CUSTOMER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Priority
        <select name="priority" defaultValue={customer?.priority ?? "MEDIUM"} className={`${inputClass} mt-1`}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {humanize(priority)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium sm:col-span-2">
        Assigned caller
        <select
          name="assignedToId"
          defaultValue={customer?.assignedToId ?? ""}
          className={`${inputClass} mt-1`}
        >
          <option value="">Unassigned</option>
          {callers.map((caller) => (
            <option key={caller.id} value={caller.id}>
              {caller.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium sm:col-span-2">
        Notes
        <textarea name="notes" rows={4} defaultValue={customer?.notes ?? ""} className={`${inputClass} mt-1`} />
      </label>

      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : customer?.id ? "Save changes" : "Add customer"}
        </button>
        {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={`${inputClass} mt-1`}
      />
    </label>
  );
}

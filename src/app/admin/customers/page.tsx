import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, buttonClass, inputClass, secondaryButtonClass, statusTone } from "@/components/ui";
import { CUSTOMER_STATUSES, PRIORITIES, customerLabel, humanize } from "@/lib/labels";
import ImportWizard from "./import/import-wizard";
import { DeleteMatchingButton } from "./delete-matching-button";
import { SelectAll } from "./select-all";
import { assignCountToCaller, assignSelected } from "@/app/actions/assign";
import { parseTags } from "@/lib/tags";
import { buildCustomerWhere, hasAnyFilter } from "@/lib/customer-filter";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Search = {
  q?: string;
  status?: string;
  caller?: string;
  priority?: string;
  page?: string;
  ok?: string;
  error?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim() ?? "";

  const where = buildCustomerWhere(params);
  const filtered = hasAnyFilter(params);

  const [customers, total, callers, importLogs] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { assignedTo: { select: { name: true } }, _count: { select: { calls: true } } },
    }),
    prisma.customer.count({ where }),
    prisma.user.findMany({
      where: { role: "TELECALLER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.activityLog.findMany({
      where: { action: "CSV_IMPORT" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  );

  return (
    <div className="space-y-6">
      {params.ok && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {params.ok}
        </p>
      )}
      {params.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {params.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Customers ({total})</h1>
        <div className="flex gap-2">
          <Link href={`/api/customers/export?${exportQuery}`} className={secondaryButtonClass}>
            Export CSV
          </Link>
          <Link href="/admin/customers/new" className={secondaryButtonClass}>
            Add customer
          </Link>
        </div>
      </div>

      {/* Import lives at the top of the customers page; the list below refreshes after
          an upload. Collapsible so it doesn't crowd the list. */}
      <details className="rounded-none border border-black bg-white dark:border-white dark:bg-black">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Import customers from CSV or Excel
        </summary>
        <div className="border-t border-slate-200 p-5 dark:border-slate-800">
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Only a <code>phone</code> column is required. <code>name</code>, <code>company</code>,{" "}
            <code>email</code>, <code>city</code> and <code>notes</code> are optional and matched
            case-insensitively. Rows whose phone already exists are skipped, never overwritten.
          </p>
          <ImportWizard callers={callers} />
        </div>
      </details>

      {/* Import history — one line per CSV import: when, who ran it, and the outcome. */}
      <details className="rounded-none border border-black bg-white dark:border-white dark:bg-black">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Import history ({importLogs.length})
        </summary>
        <div className="border-t border-slate-200 p-5 dark:border-slate-800">
          {importLogs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No CSV imports yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {importLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {formatDateTime(log.createdAt)}
                  </span>
                  <span className="font-medium">{log.user?.name ?? "—"}</span>
                  <span className="text-slate-600 dark:text-slate-300">{log.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <Card title="Search & filters">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, phone, company, city"
            className={`${inputClass} lg:col-span-2`}
          />
          <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
            <option value="">Any status</option>
            {CUSTOMER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
          <select name="caller" defaultValue={params.caller ?? ""} className={inputClass}>
            <option value="">Any caller</option>
            <option value="unassigned">Unassigned</option>
            {callers.map((caller) => (
              <option key={caller.id} value={caller.id}>
                {caller.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select name="priority" defaultValue={params.priority ?? ""} className={inputClass}>
              <option value="">Any priority</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {humanize(priority)}
                </option>
              ))}
            </select>
            <button type="submit" className={secondaryButtonClass}>
              Apply
            </button>
            {filtered && (
              <Link href="/admin/customers" className={secondaryButtonClass}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered
              ? "Delete removes only the customers matching the filters above (with their calls and follow-ups)."
              : "No filters set — Delete would remove every customer. Set a filter to narrow it."}
          </p>
          <DeleteMatchingButton
            count={total}
            filtered={filtered}
            filters={{ q: params.q, status: params.status, caller: params.caller, priority: params.priority }}
          />
        </div>
      </Card>

      <Card title="Quick assign to a telecaller">
        <form action={assignCountToCaller} className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Telecaller
            <select name="callerId" defaultValue="" className={`${inputClass} mt-1`} required>
              <option value="" disabled>
                Choose…
              </option>
              {callers.map((caller) => (
                <option key={caller.id} value={caller.id}>
                  {caller.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            How many
            <input
              type="number"
              name="count"
              min={1}
              max={500}
              defaultValue={50}
              className={`${inputClass} mt-1 w-28`}
            />
          </label>
          <button type="submit" className={buttonClass}>
            Assign
          </button>
          <p className="w-full text-xs text-slate-500 dark:text-slate-400">
            Hands that many currently-unassigned leads (highest priority, longest-waiting first) to the
            telecaller and sets it as their daily target. They appear in that telecaller&apos;s calling queue
            immediately.
          </p>
        </form>
      </Card>

      <Card title="Customers">
        {/* Hand-pick rows with the checkboxes, choose a telecaller, and assign the lot. */}
        <form action={assignSelected}>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-none border border-black bg-neutral-100 px-3 py-2 dark:border-white dark:bg-neutral-900">
            <span className="text-xs font-bold uppercase tracking-wide">
              Bulk assign — tick rows below, then hand them to:
            </span>
            <select name="callerId" defaultValue="" className={inputClass}>
              <option value="">Unassigned (return to pool)</option>
              {callers.map((caller) => (
                <option key={caller.id} value={caller.id}>
                  {caller.name}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass}>
              Assign selected
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">
                  <SelectAll />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Calls</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                    No customers match these filters.
                  </td>
                </tr>
              )}
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      name="customerIds"
                      value={customer.id}
                      aria-label={`Select ${customerLabel(customer)}`}
                      className="h-4 w-4 cursor-pointer accent-indigo-500"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                      {customerLabel(customer)}
                    </Link>
                    {parseTags(customer.tags).length > 0 && (
                      <span className="ml-2 space-x-1">
                        {parseTags(customer.tags).map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{customer.phone}</td>
                  <td className="px-3 py-2">{customer.company ?? "—"}</td>
                  <td className="px-3 py-2">{customer.city ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={statusTone(customer.status)}>{humanize(customer.status)}</Badge>
                  </td>
                  <td className="px-3 py-2">{humanize(customer.priority)}</td>
                  <td className="px-3 py-2">{customer.assignedTo?.name ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{customer._count.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </form>
      </Card>

      {pages > 1 && (
        <nav className="flex items-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, index) => index + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
            .map((n) => {
              const query = new URLSearchParams(
                Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
              );
              query.set("page", String(n));
              return (
                <Link
                  key={n}
                  href={`/admin/customers?${query}`}
                  className={`rounded-md px-3 py-1 ${
                    n === page
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "border border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {n}
                </Link>
              );
            })}
        </nav>
      )}
    </div>
  );
}

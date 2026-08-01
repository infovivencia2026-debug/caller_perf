import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, inputClass, secondaryButtonClass, statusTone } from "@/components/ui";
import { CUSTOMER_STATUSES, PRIORITIES, customerLabel, humanize, normalizePhone } from "@/lib/labels";
import ImportWizard from "./import/import-wizard";
import { parseTags } from "@/lib/tags";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Search = {
  q?: string;
  status?: string;
  caller?: string;
  priority?: string;
  page?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim() ?? "";

  const where: Prisma.CustomerWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.priority ? { priority: params.priority as never } : {}),
    ...(params.caller
      ? params.caller === "unassigned"
        ? { assignedToId: null }
        : { assignedToId: params.caller }
      : {}),
    ...(q
      ? {
          OR: [
            // Postgres LIKE is case-sensitive, so `mode` is required here — without it
            // searching "ramesh" would not find "Ramesh".
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { phone: { contains: normalizePhone(q) || q } },
          ],
        }
      : {}),
  };

  const [customers, total, callers] = await Promise.all([
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
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  );

  return (
    <div className="space-y-6">
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
      <details className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
          </div>
        </form>
      </Card>

      <Card title="Customers">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
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
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                    No customers match these filters.
                  </td>
                </tr>
              )}
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
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

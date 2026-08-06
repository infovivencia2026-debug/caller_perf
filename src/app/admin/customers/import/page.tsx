import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Card, secondaryButtonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";
import ImportWizard from "./import-wizard";

export const dynamic = "force-dynamic";

/**
 * Uploading a file, on its own screen.
 *
 * The wizard has always existed but only inside a collapsed panel on the customers
 * page, so every "Upload a file" link pointed at a URL that did not exist. Now that an
 * upload becomes a named list, it deserves its own page: it is the start of a
 * workflow, not a footnote on a list of leads.
 */
export default async function ImportPage() {
  await requireAdmin();

  const [callers, recent] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TELECALLER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.importList.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { uploadedBy: { select: { name: true } }, _count: { select: { members: true } } },
    }),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">Upload a file</h1>
        <div className="flex gap-2">
          <Link href="/admin/customers" className={secondaryButtonClass}>
            Customers
          </Link>
        </div>
      </div>

      <Card title="Choose a file" glow="indigo">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Only a <code>phone</code> column is required. <code>name</code>, <code>company</code>, <code>email</code>,{" "}
          <code>city</code> and <code>notes</code> are optional and matched case-insensitively. Rows whose phone
          already exists are skipped rather than overwritten — but they still count as part of this file, so the list
          reflects everything the file contained.
        </p>
        <ImportWizard callers={callers} />
      </Card>

      {recent.length > 0 && (
        <Card title="Recent uploads" glow="sky">
          <ul className="space-y-2 text-sm">
            {recent.map((list) => (
              <li key={list.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/admin/customers?list=${list.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {list.name}
                </Link>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {list._count.members.toLocaleString("en-IN")} leads · {formatDateTime(list.createdAt)}
                  {list.uploadedBy ? ` · ${list.uploadedBy.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

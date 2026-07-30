import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import ImportWizard from "./import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Import customers</h1>
      <Card title="CSV upload">
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Expected columns: <code>name</code>, <code>phone</code>, and optionally <code>company</code>,{" "}
          <code>email</code>, <code>city</code>, <code>notes</code>. Column names are matched
          case-insensitively. Rows whose phone number already exists are skipped, never overwritten.
        </p>
        <ImportWizard callers={callers} />
      </Card>
    </div>
  );
}

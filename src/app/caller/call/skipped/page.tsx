import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { Badge, Card, Row, buttonClass, secondaryButtonClass, statusTone } from "@/components/ui";
import { customerLabel, formatDuration, humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import { parseTags } from "@/lib/tags";
import { clearSkips } from "@/app/actions/calls";

export const dynamic = "force-dynamic";

/**
 * Full details of the customers set aside during this calling session. The skip list
 * travels in the URL, so this page is a plain link away from the calling screen and
 * carries the same list back when the caller returns.
 */
export default async function SkippedPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  const session = await requireCaller();
  const { skip } = await searchParams;
  const cookieStore = await cookies();
  const cookieSkip = (cookieStore.get("cp_skip")?.value ?? "").split(",").filter(Boolean);
  const skipIds = [...new Set([...(skip ?? "").split(",").filter(Boolean), ...cookieSkip])];

  const customers =
    skipIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: skipIds }, assignedToId: session.userId },
          select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            city: true,
            email: true,
            notes: true,
            tags: true,
            status: true,
            priority: true,
            calls: {
              orderBy: { startedAt: "desc" },
              take: 3,
              select: { startedAt: true, status: true, duration: true, response: true },
            },
          },
        })
      : [];

  // Preserve the order they were skipped in rather than the database's.
  const ordered = skipIds
    .map((id) => customers.find((entry) => entry.id === id))
    .filter((entry): entry is (typeof customers)[number] => Boolean(entry));

  const backHref = skipIds.length > 0 ? `/caller/call?skip=${skipIds.join(",")}` : "/caller/call";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backHref} className={secondaryButtonClass} aria-label="Back to calling screen">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">Skipped this session ({ordered.length})</h1>
        </div>
        <form action={clearSkips}>
          <button type="submit" className={buttonClass}>
            Bring them all back
          </button>
        </form>
      </div>

      {ordered.length === 0 ? (
        <Card title="Nothing skipped">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You have not skipped anyone in this session. Skipping a customer moves past them for
            now; they return to your queue the next time you start calling.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            These customers were passed over during this session. They are still assigned to you and
            return to the queue when you start over.
          </p>

          <div className="grid gap-3 lg:grid-cols-2">
            {ordered.map((entry, index) => (
              <Card
                key={entry.id}
                title={`${index + 1}. ${customerLabel(entry)}`}
                action={
                  <Link href={`/caller/call?focus=${entry.id}&skip=${skipIds.join(",")}`} className={buttonClass}>
                    Call again
                  </Link>
                }
              >
                <dl className="space-y-2 text-sm">
                  <Row label="Phone">
                    <a
                      href={`tel:${entry.phone}`}
                      className="text-base font-semibold tabular-nums tracking-wide hover:underline"
                    >
                      {entry.phone}
                    </a>
                  </Row>
                  <Row label="Company">{entry.company ?? "—"}</Row>
                  <Row label="City">{entry.city ?? "—"}</Row>
                  <Row label="Email">{entry.email ?? "—"}</Row>
                  <Row label="Status">
                    <Badge tone={statusTone(entry.status)}>{humanize(entry.status)}</Badge>
                  </Row>
                  <Row label="Priority">{humanize(entry.priority)}</Row>
                  {parseTags(entry.tags).length > 0 && (
                    <Row label="Tags">
                      <span className="space-x-1">
                        {parseTags(entry.tags).map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </span>
                    </Row>
                  )}
                  {entry.notes && (
                    <Row label="Notes">
                      <span className="whitespace-pre-wrap">{entry.notes}</span>
                    </Row>
                  )}
                  <Row label="Call history">
                    {entry.calls.length === 0 ? (
                      "Never called"
                    ) : (
                      <ol className="space-y-2">
                        {entry.calls.map((call, i) => (
                          <li key={i}>
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge tone={statusTone(call.status)}>{humanize(call.status)}</Badge>
                              <span className="text-slate-500 dark:text-slate-400">
                                {formatDateTime(call.startedAt)} · {formatDuration(call.duration)}
                              </span>
                            </span>
                            {call.response && <span className="block">{call.response}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </Row>
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

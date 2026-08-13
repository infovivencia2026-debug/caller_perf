import Link from "next/link";
import { requireCaller } from "@/lib/auth";
import { BentoStat, BentoTile, Badge, bentoButtonClass, statusTone } from "@/components/ui";
import { customerLabel, humanize } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import { getShouldCallList } from "@/lib/should-call";

export const dynamic = "force-dynamic";

/**
 * Everyone tried today but not reached — no answer, busy, switched off. A busy line at
 * 11am is usually free by 4pm, so these stay callable for the rest of the day instead
 * of waiting for tomorrow's queue.
 *
 * "Call" opens the normal calling screen pinned to that lead, so start/end/save and
 * everything else behaves exactly as it does for a queued call.
 */
export default async function ShouldCall() {
  const session = await requireCaller();
  const entries = await getShouldCallList(session.userId);

  const attempts = entries.reduce((sum, entry) => sum + entry.attempts, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
        <h1 className="text-lg font-semibold">Should call</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No-answer / busy leads from earlier days — retried after today&apos;s queue
        </p>
      </div>

      <div className="bento-grid">
        <BentoStat label="Waiting" value={entries.length} span={4} glow="amber" hint="Leads still to reach today" />
        <BentoStat label="Attempts" value={attempts} span={4} glow="indigo" hint="Tries logged against them" />
        <BentoStat
          label="Ready to retry"
          value={entries.length}
          span={4}
          glow="emerald"
          hint="All from earlier days — callable now"
        />

        <BentoTile title={`Not reached (${entries.length})`} glow="amber" span={12}>
          {entries.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Nobody is waiting — every lead you tried today was either reached or is still in your queue.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.customerId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/caller/customers/${entry.customerId}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {customerLabel(entry)}
                    </Link>
                    <span className="ml-2 tabular-nums text-neutral-500 dark:text-neutral-400">{entry.phone}</span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                      Last tried {formatDateTime(entry.lastTriedAt)}
                      {entry.attempts > 1 ? ` · ${entry.attempts} attempts` : ""}
                      {entry.company ? ` · ${entry.company}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(entry.lastStatus)}>{humanize(entry.lastStatus)}</Badge>
                    {/* Same screen as a queued call — focus just pins this lead. */}
                    <Link href={`/caller/call?focus=${entry.customerId}`} className={bentoButtonClass}>
                      Call
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BentoTile>
      </div>
    </div>
  );
}

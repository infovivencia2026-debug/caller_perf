import Link from "next/link";
import { requireCaller } from "@/lib/auth";
import { addMyCustomer } from "@/app/actions/my-customers";
import { BentoTile, bentoButtonClass, bentoGhostButtonClass, bentoInputClass } from "@/components/ui";
import { PRIORITIES, humanize } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Add a lead the counsellor sourced themselves. Only the phone is required — everything
 * else can be filled in on the call, where the same fields are editable.
 */
export default async function AddCustomer({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireCaller();
  const { error } = await searchParams;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Add customer</h1>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="bento-grid">
        <BentoTile title="New lead" glow="emerald" span={7}>
          <form action={addMyCustomer} className="space-y-3">
            <label className="block text-sm font-medium">
              Phone <span className="text-rose-600 dark:text-rose-400">*</span>
              <input
                name="phone"
                required
                inputMode="tel"
                autoComplete="off"
                placeholder="10-digit mobile number"
                className={`${bentoInputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium">
              Name
              <input name="name" autoComplete="off" className={`${bentoInputClass} mt-1`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Company
                <input name="company" autoComplete="off" className={`${bentoInputClass} mt-1`} />
              </label>
              <label className="block text-sm font-medium">
                City
                <input name="city" autoComplete="off" className={`${bentoInputClass} mt-1`} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Email
              <input type="email" name="email" autoComplete="off" className={`${bentoInputClass} mt-1`} />
            </label>
            <label className="block text-sm font-medium">
              Priority
              <select name="priority" defaultValue="MEDIUM" className={`${bentoInputClass} mt-1`}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {humanize(priority)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea name="notes" rows={3} className={`${bentoInputClass} mt-1`} />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className={bentoButtonClass}>
                Add customer
              </button>
              <Link href="/caller/call" className={bentoGhostButtonClass}>
                Cancel
              </Link>
            </div>
          </form>
        </BentoTile>

        <BentoTile title="How this works" glow="sky" span={5}>
          <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <li>The lead is assigned to you, so it joins your queue and nobody else&apos;s.</li>
            <li>Only the phone number is required — the rest can be filled in on the call.</li>
            <li>
              The number is the unique key. If it already exists and is unassigned, it becomes yours; if it belongs to
              another counsellor, you will be told whose it is rather than creating a duplicate.
            </li>
          </ul>
        </BentoTile>
      </div>
    </div>
  );
}

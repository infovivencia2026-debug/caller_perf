import { changeOwnPassword, resetCallerPassword } from "@/app/actions/account";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const { ok, error } = await searchParams;

  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      {ok && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Change your password">
          <form action={changeOwnPassword} className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Signed in as <span className="font-medium text-slate-700 dark:text-slate-200">{session.name}</span>.
            </p>
            <label className="block text-sm font-medium">
              Current password
              <PasswordInput
                name="currentPassword"
                required
                autoComplete="current-password"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium">
              New password
              <PasswordInput
                name="newPassword"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password
              <PasswordInput
                name="confirmPassword"
                required
                minLength={8}
                autoComplete="new-password"
                className={`${inputClass} mt-1`}
              />
            </label>
            <button type="submit" className={buttonClass}>
              Update password
            </button>
          </form>
        </Card>

        <Card title="Reset a telecaller's password">
          {callers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No telecallers yet. Add one from the Telecallers page.
            </p>
          ) : (
            <form action={resetCallerPassword} className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sets a new password immediately. The telecaller is not notified — share it with them
                yourself.
              </p>
              <label className="block text-sm font-medium">
                Telecaller
                <select name="callerId" required defaultValue="" className={`${inputClass} mt-1`}>
                  <option value="" disabled>
                    Choose a telecaller
                  </option>
                  {callers.map((caller) => (
                    <option key={caller.id} value={caller.id}>
                      {caller.name} ({caller.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                New password
                <PasswordInput
                  name="newPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <button type="submit" className={buttonClass}>
                Reset password
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

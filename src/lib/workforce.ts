import { Client } from "pg";

/**
 * Connection string for the workforce-os database. It lives on the same Postgres server
 * as ours, so by default we reuse our own DB credentials and just swap the database name
 * — no extra secret to manage. Set WORKFORCE_DB_URL to override.
 */
function workforceUrl(): string | null {
  if (process.env.WORKFORCE_DB_URL) return process.env.WORKFORCE_DB_URL;
  const own = process.env.DATABASE_URL;
  if (!own) return null;
  try {
    const url = new URL(own);
    url.pathname = "/workforce_os";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Emails of employees who have punched in (checked in) today, India time. Best-effort:
 * returns [] and never throws upward if workforce-os is unreachable or access is not yet
 * granted, so attendance sync can degrade gracefully to manual "Mark present".
 */
export async function fetchPresentEmailsToday(): Promise<string[]> {
  const url = workforceUrl();
  if (!url) return [];
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const res = await client.query<{ email: string }>(
      `SELECT DISTINCT lower(us.email) AS email
         FROM attendance a
         JOIN employees e ON e.id = a.employee_id
         JOIN users us ON us.id = e.user_id
        WHERE a.check_in IS NOT NULL
          AND us.email IS NOT NULL
          AND a.date = to_char((now() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD')`,
    );
    return res.rows.map((r) => r.email).filter(Boolean);
  } catch (error) {
    console.error("workforce-os attendance read failed:", (error as Error).message);
    return [];
  } finally {
    await client.end().catch(() => {});
  }
}

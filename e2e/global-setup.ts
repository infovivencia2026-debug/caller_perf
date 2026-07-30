import path from "node:path";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

/**
 * Resets the database to seed state so assertions on exact counts are repeatable.
 * Uses plain SQL rather than the generated Prisma client, which Playwright's
 * TypeScript loader cannot import. Runs against DATABASE_URL — point it at a
 * scratch database.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    loadEnvFile(path.join(process.cwd(), ".env"));
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query('TRUNCATE "Call", "FollowUp", "ActivityLog" CASCADE');
  await client.query(
    `DELETE FROM "Customer" WHERE phone NOT IN ('9876543210','9876501234','9812345678','9900112233','9701234567','9611122233')`,
  );
  // Restore seed state: fresh status, no tags, callers assigned round-robin by name.
  await client.query(`
    WITH callers AS (
      SELECT id, row_number() OVER (ORDER BY name) - 1 AS n,
             count(*) OVER () AS total
      FROM "User" WHERE role = 'TELECALLER'
    ), ranked AS (
      SELECT id, row_number() OVER (ORDER BY phone) - 1 AS i FROM "Customer"
    )
    UPDATE "Customer" c
    SET status = 'NEW',
        tags = '{}',
        priority = CASE WHEN r.i % 3 = 0 THEN 'HIGH'::"Priority" ELSE 'MEDIUM'::"Priority" END,
        "assignedToId" = ca.id
    FROM ranked r, callers ca
    WHERE c.id = r.id AND ca.n = r.i % ca.total
  `);

  await client.end();
}

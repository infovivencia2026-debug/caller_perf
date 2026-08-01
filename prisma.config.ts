import path from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

try {
  loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env is optional when DATABASE_URL is already in the environment
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Migrations run over a direct connection when one is provided. Poolers such as
    // Neon's or Supabase's do not support the statements Prisma Migrate issues, while
    // the app itself is happy on the pooled DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});

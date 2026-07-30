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
    url: process.env.DATABASE_URL,
  },
});

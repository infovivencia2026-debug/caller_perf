import path from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";

// Loaded here rather than in globalSetup so that the values reach the worker
// processes too — they inherit this process's environment.
try {
  loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env is optional when the variables are already exported
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://localhost:3210" },
  webServer: {
    // `next start -p` rather than a PORT env prefix, which is not valid on Windows shells.
    command: "npm run build && npx next start -p 3210",
    url: "http://localhost:3210/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

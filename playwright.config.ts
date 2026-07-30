import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://localhost:3210" },
  webServer: {
    command: "npm run build && PORT=3210 npm run start",
    url: "http://localhost:3210/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

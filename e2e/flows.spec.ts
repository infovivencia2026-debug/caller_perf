import { expect, test } from "@playwright/test";
import path from "node:path";

// Matches whatever the scratch database was seeded with; SEED_PASSWORD overrides the
// demo default, so the suite has to read the same value rather than assume it.
const PASSWORD = process.env.SEED_PASSWORD || "password123";
const ADMIN = { email: "admin@example.com", password: PASSWORD };
const CALLER = { email: "lakshmi@example.com", password: PASSWORD };

async function signIn(page: import("@playwright/test").Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|caller)$/, { timeout: 15_000 }).catch(() => {});
}

test("rejects a bad password", async ({ page }) => {
  await signIn(page, { email: CALLER.email, password: "wrong" });
  await expect(page.getByText("Invalid email or password")).toBeVisible();
});

test("telecaller logs a call with a follow-up and advances the queue", async ({ page }) => {
  await signIn(page, CALLER);
  await expect(page).toHaveURL(/\/caller$/);
  await expect(page.getByText("Today's target")).toBeVisible();

  await page.getByRole("link", { name: "Open calling screen" }).click();
  await expect(page).toHaveURL(/\/caller\/call/);

  // The current customer is identified by their phone (the first tel: link) and name.
  const firstPhone = await page.locator('a[href^="tel:"]').first().innerText();
  const firstName = await page.locator('input[name="name"]').inputValue();
  const firstLabel = firstName || firstPhone;

  // Saving is blocked until the call has been timed.
  await expect(page.getByRole("button", { name: /Save response/ })).toBeDisabled();

  await page.getByRole("button", { name: "Start call" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "End call" }).click();
  await expect(page.getByRole("button", { name: /Save response/ })).toBeEnabled();

  await page.selectOption('select[name="status"]', "INTERESTED");
  await page.fill('input[name="response"]', "Wants a brochure");
  await page.fill('textarea[name="comments"]', "Call back after Monday");
  await page.fill('input[name="followUpDate"]', "2026-08-05T10:30");
  await page.selectOption('select[name="priority"]', "HIGH");
  await page.getByRole("button", { name: /Save response/ }).click();

  // Lands back on the calling screen with the next customer in the queue.
  await expect(page).toHaveURL(/\/caller\/call/);
  await expect(page.locator('a[href^="tel:"]').first()).not.toHaveText(firstPhone);

  // Recent activity on the dashboard reflects the logged call.
  await page.goto("/caller");
  await expect(page.getByText("Recent activity")).toBeVisible();
  await expect(page.getByText("Interested").first()).toBeVisible();
  await expect(page.getByText(firstLabel).first()).toBeVisible();

  // The follow-up is scheduled for a future date, so it is not in today's list
  // but is recorded against the customer.
  await expect(page.getByText("No follow-ups due today.")).toBeVisible();
});

test("skip moves past a customer without logging a call", async ({ page }) => {
  await signIn(page, CALLER);
  await page.goto("/caller/call");
  const firstPhone = await page.locator('a[href^="tel:"]').first().innerText();
  await page.getByRole("button", { name: /^Skip/ }).click();
  await expect(page).toHaveURL(/skip=/);
  await expect(page.locator('a[href^="tel:"]').first()).not.toHaveText(firstPhone);
});

test("admin imports a CSV, sees duplicates reported, then filters and edits", async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Total telecallers")).toBeVisible();

  // Import now lives at the top of the Customers page.
  await page.goto("/admin/customers");
  await page.getByText("Import customers from CSV or Excel").click();
  await page.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures", "customers.csv"));
  await expect(page.getByText(/Preview — all 4 customer\(s\)/)).toBeVisible();
  await page.getByRole("button", { name: /Import 4 row/ }).click();

  await expect(page.getByText("Imported 2 customer(s).")).toBeVisible();
  await expect(page.getByText("Skipped — already in database: 1")).toBeVisible();
  await expect(page.getByText("Skipped — duplicate rows in file: 1")).toBeVisible();

  await page.goto("/admin/customers");
  await page.fill('input[name="q"]', "Kavitha");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("link", { name: "Kavitha Iyer" }).click();

  await page.selectOption('select[name="status"]', "INTERESTED");
  await page.fill('input[name="tags"]', "vip, south");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.goto("/admin/customers");
  await expect(page.getByText("vip").first()).toBeVisible();
});

test("a telecaller cannot reach admin pages", async ({ page }) => {
  await signIn(page, CALLER);
  await page.goto("/admin/customers");
  await expect(page).toHaveURL(/\/caller$/);
});

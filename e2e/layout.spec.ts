import { expect, test } from "@playwright/test";

const CALLER = { email: "lakshmi@example.com", password: "password123" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', CALLER.email);
  await page.fill('input[name="password"]', CALLER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/caller$/, { timeout: 15_000 });
}

test("sidebar is docked full height on desktop and content fills the rest", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();

  const box = (await sidebar.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(Math.round(box.width)).toBe(256);
  // Full viewport height, no gap above or below.
  expect(Math.round(box.height)).toBe(900);

  // The hamburger bar is desktop-hidden.
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();

  // Content starts to the right of the sidebar and reaches the right edge.
  const main = (await page.locator("main").boundingBox())!;
  expect(main.x).toBeGreaterThanOrEqual(256);
  // Reaches the right edge, allowing for the scrollbar gutter.
  expect(main.x + main.width).toBeGreaterThan(1440 - 20);

  const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  expect(heading.x).toBeGreaterThan(256);
});

test("no horizontal overflow at any width", async ({ page }) => {
  await signIn(page);
  for (const width of [360, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/caller/call");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `viewport ${width}px overflows`).toBeLessThanOrEqual(0);
  }
});

test("sidebar collapses behind a toggle on mobile and closes on navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  const sidebar = page.locator("aside");
  // Off-canvas: translated fully out of view.
  await expect(sidebar).toHaveClass(/-translate-x-full/);
  const closed = (await sidebar.boundingBox())!;
  expect(closed.x + closed.width).toBeLessThanOrEqual(0);

  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(sidebar).not.toHaveClass(/-translate-x-full/);
  // Wait for the slide-in transition to settle.
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.x)).toBe(0);
  expect(Math.round((await sidebar.boundingBox())!.height)).toBe(844);

  await page.locator("aside").getByRole("link", { name: "Calling screen" }).click();
  await expect(page).toHaveURL(/\/caller\/call/);
  await expect(sidebar).toHaveClass(/-translate-x-full/);
  await expect.poll(async () => {
    const box = (await sidebar.boundingBox())!;
    return box.x + box.width;
  }).toBeLessThanOrEqual(0);
});

test("exactly one sidebar link is marked active per route", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  const current = page.locator('aside a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("Dashboard");

  // A child route must not leave the section root highlighted too.
  await page.goto("/caller/call");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("Calling screen");
});

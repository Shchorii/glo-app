import { test, expect } from "@playwright/test";

/**
 * Booking funnel smoke test.
 *
 * Every assertion here corresponds to a defect that actually shipped. Do not
 * delete one because it looks obvious — each is obvious only in hindsight.
 *
 * Needs a test account:
 *   GLO_TEST_EMAIL, GLO_TEST_PASSWORD, GLO_BASE_URL
 */
const BASE = process.env.GLO_BASE_URL ?? "https://app.we-are-glo.com";
const EMAIL = process.env.GLO_TEST_EMAIL;
const PASSWORD = process.env.GLO_TEST_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "GLO_TEST_EMAIL / GLO_TEST_PASSWORD not set");

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(book|campaigns|dashboard)/, { timeout: 20000 });
});

test("advertiser outside covered metros still gets a usable map", async ({ page, context }) => {
  // Tel Aviv has no inventory. Regression: this rendered an empty map.
  await context.setGeolocation({ latitude: 32.0853, longitude: 34.7818 });
  await context.grantPermissions(["geolocation"]);
  await page.goto(`${BASE}/book`);

  await expect(page.getByText(/No Glo screens near/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/screens within \d+km/i)).toBeVisible();
});

test("badge never claims live inventory over demo stock", async ({ page }) => {
  await page.goto(`${BASE}/book`);
  await page.waitForSelector("text=/screens within/i", { timeout: 20000 });
  // Regression: said LIVE INVENTORY with zero screens loaded.
  await expect(page.getByText(/demo inventory/i)).toBeVisible();
});

test("dense viewports cluster instead of rendering a marker blob", async ({ page }) => {
  await page.goto(`${BASE}/book`);
  await page.getByPlaceholder(/ZIP, neighborhood or city/i).fill("11249");
  await expect(page.getByText(/screens near 11249/i)).toBeVisible({ timeout: 20000 });

  // Regression: 400+ individual dots at street zoom.
  const dots = page.locator(".glo-book-marker");
  const bubbles = page.locator(".glo-cluster");
  await expect
    .poll(async () => (await bubbles.count()) > 0 || (await dots.count()) <= 120, { timeout: 15000 })
    .toBe(true);
});

test("price stays identical from card to review", async ({ page }) => {
  await page.goto(`${BASE}/book`);
  await page.getByPlaceholder(/ZIP, neighborhood or city/i).fill("11249");
  await expect(page.getByText(/screens near 11249/i)).toBeVisible({ timeout: 20000 });

  const chip = page.locator("button", { hasText: /from \$\d+\/d/ }).first();
  const chipText = (await chip.textContent()) ?? "";
  const fromPrice = Number(chipText.match(/from \$(\d+)\/d/)?.[1]);
  expect(fromPrice).toBeGreaterThan(0);
  await chip.click();

  // Footer shows the all-day daily rate for the selection.
  const footer = page.getByText(/1 screen · \$\d+/);
  await expect(footer).toBeVisible();
  const daily = Number(((await footer.textContent()) ?? "").match(/\$(\d+)/)?.[1]);

  // The advertised floor must be the cheapest daypart share of the real rate.
  expect(fromPrice).toBe(Math.ceil(daily * 0.15));

  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByText(/1 day × \$\d+\/day/)).toBeVisible();
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /Skip for now/i }).click();

  // Review must agree with the card, not recompute differently.
  await expect(page.getByText(/TOTAL/i)).toBeVisible();
  await expect(page.getByText(new RegExp(`\\$${daily}`))).toBeVisible();
});

test("radius selects in bulk without hanging", async ({ page }) => {
  await page.goto(`${BASE}/book`);
  await page.waitForSelector("text=/screens within/i", { timeout: 20000 });

  await page.getByRole("button", { name: "Radius" }).click();
  const map = page.locator(".leaflet-container");
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2 + 120, box.y + box.height / 2 + 90);

  // Must land a multi-screen selection and stay responsive.
  await expect(page.getByText(/\d{2,} screens · \$[\d,]+/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
});

test("clicking a screen shows its exact location and never stacks dots", async ({ page }) => {
  await page.goto(`${BASE}/book`);
  await page.waitForSelector("text=/screens within/i", { timeout: 20000 });
  await page.waitForTimeout(1500);

  // Regression: overlapping dots made individual screens unreadable and untappable.
  const stacked = await page.evaluate(() => {
    const pts = [...document.querySelectorAll(".glo-book-marker, .glo-cluster")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    });
    let n = 0;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 20) n++;
    return n;
  });
  expect(stacked).toBe(0);

  for (let i = 0; i < 5 && (await page.locator(".glo-book-marker").count()) === 0; i++) {
    await page.locator(".glo-cluster").first().click();
    await page.waitForTimeout(1200);
  }
  await page.locator(".glo-book-marker").first().click({ force: true });

  // Regression: the hover label was the only place a screen was identified.
  const card = page.getByTestId("pinned-card");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("pinned-address")).not.toHaveText(/Finding address/, { timeout: 15000 });
  await expect(card.getByRole("link", { name: /Google Maps/ })).toHaveAttribute("href", /maps\/search/);
});

test("list view agrees with the map filters, paginates, and the URL restores it", async ({ page }) => {
  await page.goto(`${BASE}/book?city=Chicago&venue=bar&view=list`);
  const caption = page.getByTestId("list-caption");
  await expect(caption).toHaveText(/Showing 1–\d+ of [\d,]+ screens/, { timeout: 20000 });
  // Regression: List view rendered every screen as a card.
  expect(await page.locator("button.card-tight").count()).toBeLessThanOrEqual(60);
  for (const t of await page.locator("button.card-tight").allInnerTexts()) {
    expect(t).toMatch(/Chicago/);
    expect(t).toMatch(/bar/i);
  }
});

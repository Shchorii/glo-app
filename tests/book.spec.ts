import { test, expect, type Page } from "@playwright/test";

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

const MAP = "[aria-label='Map of screens available to book']";

/**
 * IDA-15 centre gap, plus drawn-edge overlap. A screen's hit box is 40px but
 * the dot is 14px (radius 7); cluster bubbles are the element itself.
 */
async function markerSpacing(page: Page) {
  return page.evaluate(() => {
    const pts = [...document.querySelectorAll(".glo-book-marker, .glo-cluster")].map((el) => {
      const r = el.getBoundingClientRect();
      const radius = el.classList.contains("glo-cluster") ? r.width / 2 : 7;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, radius };
    });
    let close = 0;
    let overlap = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 20) close++;
        if (d < pts[i].radius + pts[j].radius) overlap++;
      }
    }
    return { close, overlap, n: pts.length };
  });
}

async function expectSeparated(page: Page) {
  await expect.poll(async () => {
    const s = await markerSpacing(page);
    return s.n > 0 && s.close === 0 && s.overlap === 0;
  }, { timeout: 15000 }).toBe(true);
}

/** Zoom via the control. Scroll-wheel zoom is disabled. */
async function zoomOutBy(page: Page, steps: number) {
  const btn = page.locator(".leaflet-control-zoom-out");
  const map = page.locator(MAP);
  for (let i = 0; i < steps; i++) {
    if (await btn.evaluate((el) => el.classList.contains("leaflet-disabled"))) break;
    const before = await map.getAttribute("data-zoom");
    await btn.click();
    await expect.poll(async () => {
      const zoom = await map.getAttribute("data-zoom");
      const disabled = await btn.evaluate((el) => el.classList.contains("leaflet-disabled"));
      return disabled || zoom !== before;
    }, { timeout: 8000 }).toBe(true);
  }
}

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

  const chip = page.locator("button", { hasText: /\$\d+\/day/ }).first();
  const chipText = (await chip.textContent()) ?? "";
  const chipDaily = Number(chipText.match(/\$(\d+)\/day/)?.[1]);
  expect(chipDaily).toBeGreaterThan(0);
  // Chip is the all-day $/day rate, not a late-night "from $N/d" anchor.
  expect(chipText).not.toMatch(/from \$\d+\/d/);
  await chip.click();

  // Footer shows the all-day daily rate for the selection.
  const footer = page.getByText(/1 screen · \$\d+/);
  await expect(footer).toBeVisible();
  const daily = Number(((await footer.textContent()) ?? "").match(/\$(\d+)/)?.[1]);
  expect(chipDaily).toBe(daily);

  // List card: primary is the all-day rate; late night is an explicit slot price.
  await page.getByRole("button", { name: "List" }).click();
  const listCard = page.locator("button.card-tight", { hasText: /late night/i }).first();
  await expect(listCard).toBeVisible({ timeout: 20000 });
  const listText = (await listCard.textContent()) ?? "";
  const listDaily = Number(listText.match(/\$(\d+)\/day/)?.[1]);
  const lateNight = Number(listText.match(/from \$(\d+)/)?.[1]);
  expect(listText.toLowerCase()).toContain("late night");
  expect(lateNight).toBe(Math.ceil(listDaily * 0.15));
  expect(listText).not.toMatch(/from \$\d+\/d/);

  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByText(/1 day × \$\d+\/day/)).toBeVisible();
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /Skip for now/i }).click();

  // Review must agree with the chip and the footer, not a slot price.
  await expect(page.getByText(/TOTAL/i)).toBeVisible();
  await expect(page.getByText(new RegExp(`\\$${daily}/day`))).toBeVisible();
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
  await expectSeparated(page);

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

test("metro zoom and full zoom-out keep markers apart and show the whole US", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${BASE}/book`);
  await page.waitForSelector("text=/screens within/i", { timeout: 20000 });
  await expectSeparated(page);

  const map = page.locator(MAP);
  const localZoom = Number(await map.getAttribute("data-zoom"));
  await zoomOutBy(page, 2);
  // Two clicks down from the local view (13 → 11): the metro zoom QA measured.
  expect(Number(await map.getAttribute("data-zoom"))).toBe(localZoom - 2);
  await expectSeparated(page);

  const zoomOut = page.locator(".leaflet-control-zoom-out");
  for (let i = 0; i < 24; i++) {
    if (await zoomOut.evaluate((el) => el.classList.contains("leaflet-disabled"))) break;
    await zoomOutBy(page, 1);
  }
  await expect(zoomOut).toHaveClass(/leaflet-disabled/);
  await expectSeparated(page);

  // Contiguous US (lat 24–50, lng −125 to −66) is inside the viewport.
  const bounds = {
    south: Number(await map.getAttribute("data-south")),
    north: Number(await map.getAttribute("data-north")),
    west: Number(await map.getAttribute("data-west")),
    east: Number(await map.getAttribute("data-east")),
  };
  expect(bounds.south).toBeLessThanOrEqual(24);
  expect(bounds.north).toBeGreaterThanOrEqual(50);
  expect(bounds.west).toBeLessThanOrEqual(-125);
  expect(bounds.east).toBeGreaterThanOrEqual(-66);
});

test("full zoom-out shows the whole US on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${BASE}/book`);
  await page.waitForSelector("text=/screens within/i", { timeout: 20000 });

  const zoomOut = page.locator(".leaflet-control-zoom-out");
  for (let i = 0; i < 24; i++) {
    if (await zoomOut.evaluate((el) => el.classList.contains("leaflet-disabled"))) break;
    await zoomOutBy(page, 1);
  }
  await expect(zoomOut).toHaveClass(/leaflet-disabled/);
  await expectSeparated(page);

  const map = page.locator(MAP);
  expect(Number(await map.getAttribute("data-south"))).toBeLessThanOrEqual(24);
  expect(Number(await map.getAttribute("data-north"))).toBeGreaterThanOrEqual(50);
  expect(Number(await map.getAttribute("data-west"))).toBeLessThanOrEqual(-125);
  expect(Number(await map.getAttribute("data-east"))).toBeGreaterThanOrEqual(-66);
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

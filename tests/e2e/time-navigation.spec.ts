import { expect, test } from "@playwright/test";
import { stubUpstream } from "./stubs/network";

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("selects an era and today with visible buttons", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  await page.getByRole("button", { name: "1948", exact: true }).click();
  await expect(page.locator(".time-slider")).toHaveAttribute("aria-valuenow", "1948");
  await expect(page.getByRole("button", { name: "1948", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".time-navigation__today").click();
  await expect(page.locator(".time-slider")).toHaveAttribute(
    "aria-valuenow",
    String(new Date().getFullYear()),
  );
});

test("keeps wrapped attribution clear of the active layer label", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await attribution.evaluate((element) => element.setAttribute("open", ""));
  const credit = await attribution.boundingBox();
  const badge = await page.locator(".layer-info-badge").boundingBox();
  expect(credit).not.toBeNull();
  expect(badge).not.toBeNull();
  expect(badge!.y + badge!.height).toBeLessThanOrEqual(credit!.y);
});

test("keeps the nearest-era notice below the active layer on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1972");
  await expect(page.locator(".coverage-banner")).toBeVisible();
  const notice = await page.locator(".coverage-banner").boundingBox();
  const badge = await page.locator(".layer-info-badge").boundingBox();
  expect(badge!.y + badge!.height).toBeLessThanOrEqual(notice!.y);
});

for (const size of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`keeps time controls in view at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
    await expect(page.locator(".time-navigation__year")).toHaveText("1965年");
    const bounds = await page.locator(".slider-dock").boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    expect(bounds!.height).toBeLessThan(size.height * 0.55);
    for (const selector of [
      ".time-navigation__today",
      ".time-slider",
      ".opacity-control__trigger",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    }
    // At either timeline endpoint, the thumb remains entirely inside the card.
    for (const key of ["Home", "End"]) {
      await page.locator(".time-slider").press(key);
      const thumb = await page.locator(".time-slider__thumb-hit").boundingBox();
      expect(thumb!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(thumb!.x + thumb!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    }
  });
}

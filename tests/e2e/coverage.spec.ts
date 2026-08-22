import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type CoverageState = {
  year: number;
  view: { lat: number; lng: number; zoom: number };
  timeLayer: {
    activeLayerId: string | null;
    resolution: { reason: string; candidates: string[]; snapped: boolean };
  };
};

type DebugHook = { getState(): CoverageState; setView(view: CoverageState["view"]): void };
type E2eWindow = Window & {
  __chronomapCoverageToggles?: () => number;
  __chronomapDebug?: DebugHook;
};

async function readState(page: Page): Promise<CoverageState> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState();
  });
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page, { missing: [{ layerId: "gsi-gazo1", zoom: 17 }] });
});

test("offers a nearby era and moves the year and camera when selected", async ({ page }) => {
  await page.goto("/?lat=45.804&lng=140&z=17&year=1930");

  const banner = page.locator(".coverage-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-state", "no-coverage");
  await expect(banner.locator(".coverage-banner__action")).toContainText("1976年代");

  await banner.locator(".coverage-banner__action").click();

  await expect.poll(async () => (await readState(page)).year).toBe(1976);
  await expect.poll(async () => (await readState(page)).timeLayer.resolution.reason).toBe("ok");
  await expect.poll(async () => (await readState(page)).view.lng).toBeCloseTo(137.25, 1);
  await expect.poll(() => new URL(page.url()).searchParams.get("year")).toBe("1976");
  await expect
    .poll(async () => {
      const state = await readState(page);
      const url = new URL(page.url());
      return (
        url.searchParams.get("lat") === String(state.view.lat) &&
        url.searchParams.get("lng") === String(state.view.lng) &&
        url.searchParams.get("z") === String(state.view.zoom)
      );
    })
    .toBe(true);
  await expect(banner.locator(".coverage-banner__action")).toBeHidden();
  assertNoUnstubbedRequests(page);
});

test("shows and then auto-hides the snapped era badge", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1972");

  const banner = page.locator(".coverage-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-state", "snapped");
  await expect(banner).toContainText("1974–1978");
  await expect(banner).toHaveCSS("pointer-events", "none");
  const bannerBox = await banner.boundingBox();
  const dockBox = await page.locator(".slider-dock").boundingBox();
  if (bannerBox === null || dockBox === null)
    throw new Error("Expected visible map chrome bounds.");
  expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(dockBox.y + 1);
  await expect(banner).toBeHidden({ timeout: 5_000 });
  assertNoUnstubbedRequests(page);
});

test("does not strobe when a pan crosses the coverage edge within hysteresis", async ({ page }) => {
  await page.goto("/?lat=45.804&lng=140&z=17&year=1930");

  const banner = page.locator(".coverage-banner");
  await expect(banner).toBeVisible();
  await page.evaluate(() => {
    const banner = document.querySelector<HTMLElement>(".coverage-banner");
    if (banner === null) throw new Error("Expected CoverageBanner root.");
    let previous = `${banner.hidden}:${banner.dataset.state ?? ""}`;
    let toggles = 0;
    new MutationObserver(() => {
      const next = `${banner.hidden}:${banner.dataset.state ?? ""}`;
      if (next !== previous) toggles += 1;
      previous = next;
    }).observe(banner, { attributes: true, attributeFilter: ["hidden", "data-state"] });
    (window as E2eWindow).__chronomapCoverageToggles = () => toggles;
  });
  await page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setView({ lat: 35.68, lng: 139.75, zoom: 17 });
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setView({ lat: 45.804, lng: 140, zoom: 17 });
  });
  await page.waitForTimeout(250);

  await expect(banner).toHaveAttribute("data-state", "no-coverage");
  await expect
    .poll(() => page.evaluate(() => (window as E2eWindow).__chronomapCoverageToggles?.() ?? -1))
    .toBeLessThanOrEqual(2);
  assertNoUnstubbedRequests(page);
});

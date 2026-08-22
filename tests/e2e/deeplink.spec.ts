import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const DEEP_LINK = "?lat=34.7025&lng=135.4959&z=16&year=1965";

type DebugHook = {
  getState(): { view: { lat: number; lng: number; zoom: number }; year: number };
  getMapView(): { lat: number; lng: number; zoom: number };
};

type E2eWindow = Window & {
  __chronomapDebug?: DebugHook;
  __chronomapClipboard?: string;
};

async function readDebugState(page: Page): Promise<ReturnType<DebugHook["getState"]>> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState();
  });
}

async function readMapView(page: Page): Promise<ReturnType<DebugHook["getMapView"]>> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getMapView();
  });
}

async function waitForMapView(
  page: Page,
  expected: { lat: number; lng: number; zoom: number },
): Promise<void> {
  await expect
    .poll(async () => {
      const view = await readMapView(page);
      return (
        Math.abs(view.lat - expected.lat) < 0.000001 &&
        Math.abs(view.lng - expected.lng) < 0.000001 &&
        view.zoom === expected.zoom
      );
    })
    .toBe(true);
}

test.describe("URL/state synchronization", () => {
  test.beforeEach(async ({ page }) => {
    await stubUpstream(page);
  });

  test("applies a deep link before map construction and reproduces a settled pan", async ({
    page,
  }) => {
    await page.goto(`/${DEEP_LINK}`);
    await expect(page.locator("#map canvas")).toBeVisible();
    await waitForMapView(page, { lat: 34.7025, lng: 135.4959, zoom: 16 });

    await expect.poll(async () => (await readDebugState(page)).year).toBe(1965);

    const canvas = page.locator("#map canvas");
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("Expected the map canvas bounds.");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 20, { steps: 5 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const view = await readMapView(page);
        return Math.abs(view.lat - 34.7025) > 0.000001 || Math.abs(view.lng - 135.4959) > 0.000001;
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const view = (await readDebugState(page)).view;
        return Math.abs(view.lat - 34.7025) > 0.000001 || Math.abs(view.lng - 135.4959) > 0.000001;
      })
      .toBe(true);
    await expect.poll(() => page.evaluate(() => window.location.search)).not.toBe(DEEP_LINK);
    const settledSearch = await page.evaluate(() => window.location.search);

    await page.reload();
    await expect(page.locator("#map canvas")).toBeVisible();
    const params = new URLSearchParams(settledSearch);
    await waitForMapView(page, {
      lat: Number(params.get("lat")),
      lng: Number(params.get("lng")),
      zoom: Number(params.get("z")),
    });
    await expect.poll(async () => (await readDebugState(page)).year).toBe(1965);
    assertNoUnstubbedRequests(page);
  });

  test("copies the exact share URL and shows the localized toast", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "__chronomapClipboard", {
        configurable: true,
        writable: true,
        value: "",
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText(value: string) {
            (window as E2eWindow).__chronomapClipboard = value;
          },
        },
      });
    });
    await page.goto(`/${DEEP_LINK}`);
    await expect(page.locator("#map canvas")).toBeVisible();
    await waitForMapView(page, { lat: 34.7025, lng: 135.4959, zoom: 16 });

    await page.locator(".menu-trigger").click();
    await page.locator(".menu-item").first().click();

    const expected = new URL(`/chronomap/${DEEP_LINK}`, await page.evaluate(() => location.origin))
      .href;
    await expect
      .poll(() => page.evaluate(() => (window as E2eWindow).__chronomapClipboard))
      .toBe(expected);
    await expect(page.locator(".toast")).toContainText("リンクをコピーしました");
    assertNoUnstubbedRequests(page);
  });
});

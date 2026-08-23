import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const POI_VIEW = { lat: 34.6873, lng: 135.5262, zoom: 15 };

type DebugHook = {
  getState(): { poi: { status: string; items: Array<{ id: string }> } };
  getPoiScreenPoint(id: string): { x: number; y: number } | null;
};

async function openPoi(page: Page): Promise<void> {
  await page.goto(`/?lat=${POI_VIEW.lat}&lng=${POI_VIEW.lng}&z=${POI_VIEW.zoom}`);
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const hook = (window as Window & { __chronomapDebug?: DebugHook }).__chronomapDebug;
        if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
        return hook.getState().poi.status;
      }),
    )
    .toBe("ready");
  const poiId = await page.evaluate(() => {
    const hook = (window as Window & { __chronomapDebug?: DebugHook }).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    const poi = hook.getState().poi.items[0];
    if (poi === undefined) throw new Error("Expected the fixture POI.");
    return poi.id;
  });
  const point = await page.evaluate((id) => {
    const hook = (window as Window & { __chronomapDebug?: DebugHook }).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getPoiScreenPoint(id);
  }, poiId);
  if (point === null) throw new Error("Expected the fixture POI to be projected on screen.");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".bottom-sheet[data-sheet-kind='poi']")).toBeVisible();
  await expect(page.locator(".poi-sheet__extract")).toBeVisible();
}

test("does not request or render Commons photos in the flag-off build", async ({ page }) => {
  const commonsRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "commons.wikimedia.org") {
      commonsRequests.push(request.url());
    }
  });
  await stubUpstream(page);

  await openPoi(page);
  await expect(page.locator(".poi-sheet__photos")).toHaveCount(0);
  expect(commonsRequests).toHaveLength(0);
  assertNoUnstubbedRequests(page);
});

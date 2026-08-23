import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type DebugState = {
  poi: {
    enabled: boolean;
    status: string;
    items: Array<{ id: string }>;
    selectedId: string | null;
  };
};

type DebugHook = {
  getState(): DebugState;
  setView(view: { lat: number; lng: number; zoom: number }): void;
  getPoiScreenPoint(id: string): { x: number; y: number } | null;
};

type E2eWindow = Window & { __chronomapDebug?: DebugHook };

const TOKYO_VIEW = { lat: 35.681236, lng: 139.767125, zoom: 15 };

function twentyPois(): unknown {
  return {
    batchcomplete: "",
    query: {
      geosearch: Array.from({ length: 20 }, (_, index) => ({
        pageid: 1000 + index,
        ns: 0,
        title: `東京の地点 ${index + 1}`,
        lat: TOKYO_VIEW.lat + index * 0.00005,
        lon: TOKYO_VIEW.lng + index * 0.00005,
        dist: 100 + index,
        primary: "",
      })),
    },
  };
}

async function readState(page: Page): Promise<DebugState> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState();
  });
}

async function setView(
  page: Page,
  view: { lat: number; lng: number; zoom: number },
): Promise<void> {
  await page.evaluate((nextView) => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setView(nextView);
  }, view);
}

test("fetches a bounded POI set, coalesces movement, toggles, and opens a pin sheet", async ({
  page,
}) => {
  let geosearchRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/w/api.php") geosearchRequests += 1;
  });
  await stubUpstream(page, { geosearch: twentyPois(), geosearchDelayMs: 450 });

  await page.goto(`/?lat=${TOKYO_VIEW.lat}&lng=${TOKYO_VIEW.lng}&z=${TOKYO_VIEW.zoom}`);
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect.poll(async () => (await readState(page)).poi.status).toBe("ready");
  await expect.poll(async () => (await readState(page)).poi.items.length).toBe(20);
  expect(geosearchRequests).toBe(1);
  await page.waitForTimeout(500);

  const point = await page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getPoiScreenPoint("wikipedia-ja:1000");
  });
  if (point === null) throw new Error("Expected the first POI to be projected on screen.");
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await readState(page)).poi.selectedId).toBe("wikipedia-ja:1000");
  await expect(page.locator(".bottom-sheet[data-sheet-kind='poi'] .poi-sheet")).toBeVisible();
  await page.locator(".bottom-sheet__close").click();
  await expect(page.locator(".bottom-sheet[data-sheet-kind='poi']")).toHaveCount(0);

  await setView(page, { ...TOKYO_VIEW, lat: TOKYO_VIEW.lat + 0.0001 });
  await page.waitForTimeout(450);
  expect(geosearchRequests).toBe(1);

  await setView(page, { ...TOKYO_VIEW, lat: TOKYO_VIEW.lat + 0.05 });
  await expect.poll(() => geosearchRequests).toBe(2);

  const toggle = page.locator("[data-poi-toggle='true']");
  await toggle.click();
  await expect
    .poll(async () => (await readState(page)).poi)
    .toMatchObject({ enabled: false, status: "idle", items: [], selectedId: null });

  await toggle.click();
  await expect.poll(async () => (await readState(page)).poi.enabled).toBe(true);
  await expect.poll(() => geosearchRequests).toBe(3);
  await expect.poll(async () => (await readState(page)).poi.items.length).toBe(20);

  assertNoUnstubbedRequests(page);
});

test("shows the low-zoom hint once per session and hides pins below the gate", async ({ page }) => {
  await stubUpstream(page);
  await page.goto("/?lat=35.681236&lng=139.767125&z=12");
  await expect(page.locator("[data-poi-zoom-hint='true']")).toBeVisible();
  await expect.poll(async () => (await readState(page)).poi.status).toBe("below-zoom");
  await expect.poll(async () => (await readState(page)).poi.items.length).toBe(0);

  await page.reload();
  await expect(page.locator("[data-poi-zoom-hint='true']")).toBeHidden();
  assertNoUnstubbedRequests(page);
});

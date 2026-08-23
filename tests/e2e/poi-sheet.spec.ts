import { expect, test } from "@playwright/test";

import summaryFixture from "./stubs/summary.json" with { type: "json" };
import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const POI_VIEW = { lat: 34.6873, lng: 135.5262, zoom: 15 };

type DebugHook = {
  getState(): { poi: { status: string; items: Array<{ id: string }> } };
  getPoiScreenPoint(id: string): { x: number; y: number } | null;
};

async function openPoi(page: Parameters<typeof stubUpstream>[0]): Promise<void> {
  await page.goto(`/?lat=${POI_VIEW.lat}&lng=${POI_VIEW.lng}&z=${POI_VIEW.zoom}`);
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect(page.locator("[data-poi-toggle='true']")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const hook = (window as Window & { __chronomapDebug?: DebugHook }).__chronomapDebug;
        if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
        return hook.getState().poi.status;
      }),
    )
    .toBe("ready");
  await page.waitForTimeout(500);
  const poiId = await page.evaluate(() => {
    const hook = (window as Window & { __chronomapDebug?: DebugHook }).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    const poi = hook.getState().poi.items[0];
    if (poi === undefined) throw new Error("Expected the fixture POI.");
    return poi.id;
  });
  const point = await page.evaluate((poiId) => {
    const hook = (window as Window & { __chronomapDebug?: DebugHook }).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getPoiScreenPoint(poiId);
  }, poiId);
  if (point === null) throw new Error("Expected the fixture POI to be projected on screen.");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".bottom-sheet[data-sheet-kind='poi']")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("renders immediate POI detail, safe summary content, links, and map handoff", async ({
  page,
}) => {
  let summaryRequests = 0;
  await page.route("**/api/rest_v1/page/summary/**", async (route) => {
    summaryRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(summaryFixture),
    });
  });

  await openPoi(page);
  await expect(page.locator(".poi-sheet__skeleton")).toBeVisible();
  await expect(page.locator(".poi-sheet__extract")).toContainText(
    "大阪城は、大阪市中央区にある城です。",
  );
  await expect(page.locator(".poi-sheet__thumbnail img")).toHaveAttribute("loading", "lazy");
  await expect(page.locator(".poi-sheet__thumbnail img")).toHaveAttribute(
    "referrerpolicy",
    "no-referrer",
  );
  const wikipediaLink = page.locator(".poi-sheet__actions a");
  await expect(wikipediaLink).toHaveAttribute("target", "_blank");
  await expect(wikipediaLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect.poll(() => summaryRequests).toBe(1);

  await page.locator("[data-poi-action='open-in-maps']").click();
  await expect(page.locator(".map-handoff-popover")).toBeVisible();
  await expect(page.locator("[data-handoff-target='google']")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-handoff-popover")).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("shows a retry action after a POI summary error", async ({ page }) => {
  let summaryRequests = 0;
  await page.route("**/api/rest_v1/page/summary/**", async (route) => {
    summaryRequests += 1;
    if (summaryRequests === 1) {
      await route.fulfill({ status: 500, body: "temporary failure" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(summaryFixture),
    });
  });

  await openPoi(page);
  await expect(page.locator(".poi-sheet [role='alert']")).toContainText(
    "記事を取得できませんでした",
  );
  await page.locator(".poi-sheet__retry").click();
  await expect(page.locator(".poi-sheet__extract")).toContainText(
    "大阪城は、大阪市中央区にある城です。",
  );
  expect(summaryRequests).toBe(2);
  assertNoUnstubbedRequests(page);
});

test("keeps the slider dock interactive below the POI sheet", async ({ page }) => {
  await openPoi(page);

  const dock = page.locator(".slider-dock");
  const box = await dock.boundingBox();
  if (box === null) throw new Error("Expected the slider dock to be laid out.");
  const target = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest(".slider-dock")?.className ?? null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(target).toBe("slider-dock");
});

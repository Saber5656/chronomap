import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const PICKED_VIEW = "?lat=35.681236&lng=139.767125&z=12";

type DebugHook = {
  getMapView(): { lat: number; lng: number; zoom: number };
  getPickedPoint(): { lat: number; lng: number } | null;
};

type E2eWindow = Window & {
  __chronomapDebug?: DebugHook;
  __chronomapClipboard?: string;
};

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

async function readMapView(page: Page): Promise<ReturnType<DebugHook["getMapView"]>> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getMapView();
  });
}

async function readPickedPoint(page: Page): Promise<ReturnType<DebugHook["getPickedPoint"]>> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getPickedPoint();
  });
}

async function mapCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator("#map canvas").boundingBox();
  if (box === null) throw new Error("Expected the map canvas bounds.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dispatchTouchPointer(
  page: Page,
  type: "pointerdown" | "pointermove" | "pointerup",
  point: { x: number; y: number },
  pointerId = 1,
): Promise<void> {
  await page.evaluate(
    ({ type, point, pointerId }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("#map canvas");
      if (canvas === null) throw new Error("Expected the map canvas.");
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: point.x,
          clientY: point.y,
          pointerId,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    },
    { type, point, pointerId },
  );
}

async function longPressAt(page: Page, point: { x: number; y: number }): Promise<void> {
  await dispatchTouchPointer(page, "pointerdown", point);
  await page.waitForTimeout(700);
  await dispatchTouchPointer(page, "pointerup", point);
}

test("touch long-press opens the picker and travel-here updates URL while keeping the marker", async ({
  page,
}) => {
  await page.goto(`/${PICKED_VIEW}`);
  await expect(page.locator("#map canvas")).toBeVisible();

  await longPressAt(page, await mapCenter(page));
  await expect(page.locator(".point-picker-popover")).toBeVisible();
  await expect(page.locator('[data-picker-action="travelHere"]')).toContainText(
    "ここを起点に時間旅行",
  );

  await page.locator('[data-picker-action="travelHere"]').click();
  await expect.poll(async () => (await readMapView(page)).zoom).toBe(15);
  await expect.poll(async () => page.evaluate(() => window.location.search)).toContain("z=15");
  await expect.poll(async () => (await readPickedPoint(page)) !== null).toBe(true);
  await expect(page.locator(".point-picker-popover")).toHaveCount(0);

  const center = await mapCenter(page);
  await page.mouse.click(center.x + 40, center.y + 40);
  await expect.poll(async () => await readPickedPoint(page)).toBeNull();
  assertNoUnstubbedRequests(page);
});

test("copy coordinates uses the deterministic clipboard harness and shows a toast", async ({
  page,
}) => {
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
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`/${PICKED_VIEW}`);
  await expect(page.locator("#map canvas")).toBeVisible();

  await longPressAt(page, await mapCenter(page));
  await page.locator('[data-picker-action="copyCoords"]').click();
  await expect
    .poll(() => page.evaluate(() => (window as E2eWindow).__chronomapClipboard))
    .toBe("35.681236,139.767125");
  await expect(page.locator(".toast")).toContainText("座標をコピーしました");
  assertNoUnstubbedRequests(page);
});

test("touch pan cancels the long-press and does not open the picker", async ({ page }) => {
  await page.goto(`/${PICKED_VIEW}`);
  await expect(page.locator("#map canvas")).toBeVisible();

  const center = await mapCenter(page);
  await dispatchTouchPointer(page, "pointerdown", center);
  await page.waitForTimeout(80);
  await dispatchTouchPointer(page, "pointermove", { x: center.x + 24, y: center.y + 4 });
  await dispatchTouchPointer(page, "pointerup", { x: center.x + 24, y: center.y + 4 });
  await page.waitForTimeout(700);

  await expect(page.locator(".point-picker-popover")).toHaveCount(0);
  await expect.poll(async () => await readPickedPoint(page)).toBeNull();
  assertNoUnstubbedRequests(page);
});

test("desktop contextmenu opens the same picker flow", async ({ page }) => {
  await page.goto(`/${PICKED_VIEW}`);
  await expect(page.locator("#map canvas")).toBeVisible();

  const center = await mapCenter(page);
  await page.mouse.click(center.x, center.y, { button: "right" });
  await expect(page.locator(".point-picker-popover")).toBeVisible();
  await expect(page.locator('[data-picker-action="copyCoords"]')).toContainText("座標をコピー");
  assertNoUnstubbedRequests(page);
});

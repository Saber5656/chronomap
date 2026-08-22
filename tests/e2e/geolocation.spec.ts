import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";
import { setFix } from "./geolocation";

const FIX = { lat: 35.681236, lng: 139.767125, accuracy: 35 };

type DebugHook = {
  getState(): { geo: { status: string; fix: unknown } };
  getMapView(): { lat: number; lng: number; zoom: number };
  hasUserLocationLayers(): boolean;
};

type E2eWindow = Window & {
  __chronomapDebug?: DebugHook;
  __chronomapGeoCallCount?: number;
};

async function installGeolocationCallCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let callCount = 0;
    const geolocation = navigator.geolocation;
    const original = geolocation?.getCurrentPosition.bind(geolocation);

    if (original !== undefined && geolocation !== undefined) {
      const wrapped = Object.create(geolocation) as Geolocation;
      Object.defineProperty(wrapped, "getCurrentPosition", {
        configurable: true,
        value: (
          success: PositionCallback,
          error?: PositionErrorCallback,
          options?: PositionOptions,
        ) => {
          callCount += 1;
          return original(success, error, options);
        },
      });
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: wrapped,
      });
    }

    Object.defineProperty(window, "__chronomapGeoCallCount", {
      configurable: true,
      get: () => callCount,
    });
  });
}

async function readGeoStatus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState().geo.status;
  });
}

async function readMapView(page: Page): Promise<{ lat: number; lng: number; zoom: number }> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getMapView();
  });
}

async function hasUserLocationLayers(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.hasUserLocationLayers();
  });
}

async function geoCallCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as E2eWindow).__chronomapGeoCallCount ?? -1);
}

test.describe("geolocation granted flow", () => {
  test.use({ permissions: ["geolocation"] });

  test("requires a tap, renders the fix, flies to z15, and never sends fix coordinates", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await installGeolocationCallCounter(page);
    await stubUpstream(page);
    await setFix(page, FIX.lat, FIX.lng, FIX.accuracy);

    await page.goto("/");
    const button = page.locator("button.locate-button");
    await expect(button).toBeVisible();
    expect(await geoCallCount(page)).toBe(0);

    await button.click();
    await expect(button).toHaveAttribute("data-state", "granted");
    await expect.poll(() => readGeoStatus(page)).toBe("granted");
    await expect
      .poll(async () => {
        const view = await readMapView(page);
        return (
          Math.abs(view.lat - FIX.lat) < 0.000001 &&
          Math.abs(view.lng - FIX.lng) < 0.000001 &&
          view.zoom === 15
        );
      })
      .toBe(true);
    await expect.poll(() => hasUserLocationLayers(page)).toBe(true);
    expect(await geoCallCount(page)).toBe(1);
    expect(
      requests.some((url) => url.includes(String(FIX.lat)) || url.includes(String(FIX.lng))),
    ).toBe(false);
    assertNoUnstubbedRequests(page);
  });
});

test.describe("geolocation denied flow", () => {
  test.use({ permissions: [] });

  test("shows the denied state and settings explainer after the permission error", async ({
    page,
  }) => {
    await installGeolocationCallCounter(page);
    await stubUpstream(page);
    await page.goto("/");

    const button = page.locator("button.locate-button");
    await expect(button).toBeVisible();
    expect(await geoCallCount(page)).toBe(0);

    await button.click();
    await expect(button).toHaveAttribute("data-state", "denied");
    expect(await geoCallCount(page)).toBe(1);

    await button.click();
    await expect(page.locator(".locate-popover")).toBeVisible();
    await expect(page.locator(".locate-popover")).toContainText("位置情報が許可されていません");
    assertNoUnstubbedRequests(page);
  });
});

import { expect, test } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type DebugWindow = Window & {
  __geoProtocolCalls?: Array<[string, string, string]>;
  __chronomapDebug?: {
    getMapView(): { lat: number; lng: number; zoom: number };
  };
};

async function waitForMapView(
  page: Parameters<typeof stubUpstream>[0],
  expected: { lat: number; lng: number; zoom: number },
): Promise<void> {
  await expect
    .poll(async () => {
      const view = await page.evaluate(() => {
        const debug = (window as DebugWindow).__chronomapDebug;
        if (debug === undefined) throw new Error("Expected the VITE_E2E debug hook.");
        return debug.getMapView();
      });
      return (
        Math.abs(view.lat - expected.lat) < 0.000001 &&
        Math.abs(view.lng - expected.lng) < 0.000001 &&
        Math.abs(view.zoom - expected.zoom) < 0.01
      );
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("routes a geo protocol payload through /share with one decode", async ({ page }) => {
  await page.goto("/chronomap/share?text=geo%3A35.68%2C139.76");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}`))
    .toBe("/chronomap/?lat=35.68&lng=139.76&z=16");
  await waitForMapView(page, { lat: 35.68, lng: 139.76, zoom: 16 });
  assertNoUnstubbedRequests(page);
});

test("does not double-decode a geo protocol payload", async ({ page }) => {
  await page.goto("/chronomap/share?text=geo%253A35.68%252C139.76");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect(page.locator(".bottom-sheet[role='dialog']")).toBeVisible();
  await expect(page.locator("#chronomap-import-input")).toHaveValue("geo%3A35.68%2C139.76");
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}`))
    .toBe("/chronomap/");
  assertNoUnstubbedRequests(page);
});

test("hides geo registration when the browser API is absent", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "registerProtocolHandler", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await page.locator(".menu-trigger").click();
  await expect(page.locator("[data-menu-item='register-geo']")).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("registers geo links through an explicit menu action", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: Array<[string, string, string]> = [];
    Object.defineProperty(window, "__geoProtocolCalls", { configurable: true, value: calls });
    Object.defineProperty(navigator, "registerProtocolHandler", {
      configurable: true,
      value: (protocol: string, url: string, title: string) => calls.push([protocol, url, title]),
    });
  });
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await page.locator(".menu-trigger").click();
  const registerButton = page.locator("[data-menu-item='register-geo']");
  await expect(registerButton).toBeVisible();
  await expect(registerButton).toHaveText("geo リンクをこのアプリで開く");
  await registerButton.click();

  await expect
    .poll(() => page.evaluate(() => (window as DebugWindow).__geoProtocolCalls ?? []))
    .toEqual([["geo", "http://127.0.0.1:4174/chronomap/share?text=%s", "chronomap"]]);
  await expect(page.locator(".toast")).toContainText(
    "geo リンクをこのアプリで開く設定を登録しました。",
  );
  assertNoUnstubbedRequests(page);
});

import { expect, test } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type DebugWindow = Window & {
  __chronomapDebug?: {
    getMapView(): { lat: number; lng: number; zoom: number };
    getPickedPoint(): { lat: number; lng: number } | null;
  };
};

async function readMapView(page: Parameters<typeof stubUpstream>[0]) {
  return page.evaluate(() => {
    const debug = (window as DebugWindow).__chronomapDebug;
    if (debug === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return debug.getMapView();
  });
}

async function waitForMapView(
  page: Parameters<typeof stubUpstream>[0],
  expected: { lat: number; lng: number; zoom: number },
): Promise<void> {
  await expect
    .poll(async () => {
      const view = await readMapView(page);
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

test("redirects a geo share to the canonical deep link on mobile", async ({ page }) => {
  await page.goto("/chronomap/share?text=geo%3A35.68%2C139.76");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}`))
    .toBe("/chronomap/?lat=35.68&lng=139.76&z=16");
  await waitForMapView(page, { lat: 35.68, lng: 139.76, zoom: 16 });
  await expect(page.locator(".bottom-sheet[role='dialog']")).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("redirects an Apple share with a label marker and text-only callout", async ({ page }) => {
  const appleUrl = encodeURIComponent("https://maps.apple.com/?ll=34.70,135.49&q=Osaka");
  await page.goto(`/chronomap/share?url=${appleUrl}`);
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}`))
    .toBe("/chronomap/?lat=34.7&lng=135.49&z=16&label=Osaka");
  await waitForMapView(page, { lat: 34.7, lng: 135.49, zoom: 16 });
  await expect(page.locator(".point-picker-label-callout")).toContainText("Osaka");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const debug = (window as DebugWindow).__chronomapDebug;
        return debug?.getPickedPoint() ?? null;
      }),
    )
    .toEqual({ lat: 34.7, lng: 135.49 });
  assertNoUnstubbedRequests(page);
});

test("cleans a shortlink share and opens the ImportSheet without autofocus", async ({ page }) => {
  const shortlink = encodeURIComponent("https://maps.app.goo.gl/abc");
  await page.goto(`/chronomap/share?text=${shortlink}`);
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}`))
    .toBe("/chronomap/");
  await expect(page.locator(".bottom-sheet[role='dialog']")).toBeVisible();
  await expect(page.locator("[role='alert']")).toContainText("短縮リンク");
  await expect(page.locator("#chronomap-import-input")).toHaveValue("https://maps.app.goo.gl/abc");
  await expect(page.locator("#chronomap-import-input")).not.toBeFocused();
  assertNoUnstubbedRequests(page);
});

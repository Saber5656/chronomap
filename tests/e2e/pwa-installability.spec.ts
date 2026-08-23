import { expect, test } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("PWA installability is clean in Chromium through CDP", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Chrome DevTools Protocol is Chromium-only.");

  await page.goto("/");
  await expect(page.locator("#app")).toBeVisible();

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).not.toBeNull();
  const manifestUrl = new URL(manifestHref!, page.url());
  expect(manifestUrl.pathname).toBe("/chronomap/manifest.webmanifest");

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      scope: ready.scope,
      activeScriptUrl: ready.active?.scriptURL ?? null,
    };
  });
  expect(registration.scope).toBe(new URL("/chronomap/", page.url()).href);
  expect(registration.activeScriptUrl).toMatch(/\/chronomap\/sw\.js$/u);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  const appManifest = await cdp.send("Page.getAppManifest");
  expect(appManifest.url).toBe(manifestUrl.href);
  expect(appManifest.errors).toEqual([]);
  const manifestData: unknown = appManifest.data;
  expect(typeof manifestData).toBe("string");
  if (typeof manifestData !== "string") {
    throw new Error("Chrome DevTools Protocol did not return manifest data.");
  }

  const manifest = JSON.parse(manifestData) as {
    display?: string;
    name?: string;
    share_target?: { enctype?: string; method?: string };
    start_url?: string;
  };
  expect(manifest).toMatchObject({
    name: "chronomap — 時間旅行地図",
    display: "standalone",
    start_url: ".",
    share_target: {
      enctype: "application/x-www-form-urlencoded",
      method: "GET",
    },
  });

  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
  assertNoUnstubbedRequests(page);
});

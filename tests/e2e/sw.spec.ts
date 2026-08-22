import { expect, test } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

async function readCacheState(page: Parameters<typeof stubUpstream>[0]): Promise<{
  names: string[];
  urls: string[];
}> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];

    for (const name of names) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      urls.push(...requests.map((request) => request.url));
    }

    return { names, urls };
  });
}

async function waitForControlledPage(page: Parameters<typeof stubUpstream>[0]): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test("precaches the shell, keeps caches same-origin, and reloads offline", async ({
  page,
  context,
}) => {
  await stubUpstream(page);
  await page.goto("/chronomap/");
  await expect(page.locator("#app")).toBeVisible();
  await waitForControlledPage(page);

  const cacheState = await readCacheState(page);
  expect(cacheState.names.some((name) => name.includes("precache"))).toBe(true);
  expect(cacheState.urls.length).toBeGreaterThan(0);
  expect(
    cacheState.urls.every((value) => {
      const url = new URL(value);
      return url.origin === new URL(page.url()).origin && url.pathname.startsWith("/chronomap/");
    }),
  ).toBe(true);
  expect(cacheState.urls.some((value) => value.endsWith("/chronomap/index.html"))).toBe(true);
  assertNoUnstubbedRequests(page);

  await context.setOffline(true);
  const offlineResponse = await page.reload({ waitUntil: "domcontentloaded" });
  expect(offlineResponse?.status()).toBe(200);
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#map")).toBeVisible();
  await expect(page.locator(".shell")).toBeVisible();
});

test("serves the /share navigation fallback while offline", async ({ page, context }) => {
  await stubUpstream(page);
  await page.goto("/chronomap/");
  await waitForControlledPage(page);

  await context.setOffline(true);
  const response = await page.goto("/chronomap/share?text=geo%3A35%2C139", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(200);
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator(".shell")).toBeVisible();
});

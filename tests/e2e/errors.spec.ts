import { expect, test } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const OSAKA_VIEW = { lat: 34.6873, lng: 135.5262, zoom: 15 };

type DebugWindow = Window & {
  __chronomapDebug?: {
    getState(): {
      poi: {
        status: string;
      };
      ui: {
        toast: { text: string } | null;
      };
    };
  };
};

test("announces offline/recovery once and keeps an offline menu indicator", async ({
  page,
  context,
}) => {
  await stubUpstream(page);
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();

  await context.setOffline(true);
  await expect(page.locator(".toast")).toContainText(
    "オフラインのようです — 地図データは読み込めません",
  );
  await expect(page.locator(".menu-trigger__offline-dot")).toBeVisible();

  await context.setOffline(false);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (window as DebugWindow).__chronomapDebug?.getState();
        return state?.ui.toast?.text ?? null;
      }),
    )
    .toBe("オンラインに戻りました");
  await expect(page.locator(".menu-trigger__offline-dot")).toBeHidden();

  await context.setOffline(true);
  await context.setOffline(false);
  await context.setOffline(true);
  await context.setOffline(false);
  const offlineToastCount = await page.evaluate(() => {
    const state = (window as DebugWindow).__chronomapDebug?.getState();
    return state?.ui.toast?.text === "オフラインのようです — 地図データは読み込めません" ? 1 : 0;
  });
  expect(offlineToastCount).toBe(0);
  assertNoUnstubbedRequests(page);
});

test("shows a POI fetch error pill and retries the request manually", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/w/api.php") requests += 1;
  });
  await stubUpstream(page, {
    geosearchStatuses: [500, 200],
  });

  await page.goto("/?lat=" + OSAKA_VIEW.lat + "&lng=" + OSAKA_VIEW.lng + "&z=" + OSAKA_VIEW.zoom);
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (window as DebugWindow).__chronomapDebug?.getState();
        return state?.poi.status ?? null;
      }),
    )
    .toBe("error");
  await expect(page.locator(".poi-error-banner")).toBeVisible();
  await expect(page.locator(".poi-error-banner")).toContainText("記事を取得できませんでした");

  await page.locator(".poi-error-banner__retry").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (window as DebugWindow).__chronomapDebug?.getState();
        return state?.poi.status ?? null;
      }),
    )
    .toBe("ready");
  await expect(page.locator(".poi-error-banner")).toBeHidden();
  expect(requests).toBe(2);
  assertNoUnstubbedRequests(page);
});

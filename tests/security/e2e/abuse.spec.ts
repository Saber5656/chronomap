import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "../../e2e/stubs/network";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const ALLOWLISTED_EXTERNAL_HOSTS = new Set([
  "cyberjapandata.gsi.go.jp",
  "ktgis.net",
  "ja.wikipedia.org",
  "en.wikipedia.org",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
  "creativecommons.org",
]);

type SecurityWindow = Window & {
  __chronomapCspViolations?: string[];
};

async function openImportSheet(page: Page): Promise<void> {
  const existingSheet = page.locator(".bottom-sheet[role='dialog']");
  if (await existingSheet.isVisible()) return;
  await page.locator(".menu-trigger").click();
  await page.locator("[data-menu-item='import']").click();
  await expect(existingSheet).toBeVisible();
}

function watchForeignRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    try {
      const url = new URL(request.url());
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !LOCAL_HOSTS.has(url.hostname) &&
        !ALLOWLISTED_EXTERNAL_HOSTS.has(url.hostname)
      ) {
        requests.push(url.href);
      }
    } catch {
      // The shared harness records malformed/blocked URLs separately.
    }
  });
  return requests;
}

async function installCspRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.defineProperty(window, "__chronomapCspViolations", {
      configurable: true,
      value: violations,
    });
    window.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.effectiveDirective}:${event.blockedURI}`);
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("A1 renders a hostile deep-link label as inert literal text", async ({ page }) => {
  await installCspRecorder(page);
  const foreignRequests = watchForeignRequests(page);
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  const hostileLabel = "<img src=x onerror=alert(1)>";
  await page.goto(`/?label=${encodeURIComponent(hostileLabel)}&lat=35&lng=139`);
  await expect(page.locator("#map canvas")).toBeVisible();

  const callout = page.locator(".point-picker-label-callout");
  await expect(callout).toHaveText(hostileLabel);
  await expect
    .poll(() =>
      callout.evaluate((element) => ({
        text: element.textContent,
        childCount: element.children.length,
      })),
    )
    .toEqual({ text: hostileLabel, childCount: 0 });
  expect(dialogs).toEqual([]);
  expect(
    await page.evaluate(() => (window as SecurityWindow).__chronomapCspViolations ?? []),
  ).toEqual([]);
  expect(foreignRequests).toEqual([]);
  assertNoUnstubbedRequests(page);
});

test("A3/A4 rejects javascript shared text with guidance and makes no foreign request", async ({
  page,
}) => {
  const foreignRequests = watchForeignRequests(page);
  const sharedText = "javascript:alert(1)";
  await page.goto(`/chronomap/share?text=${encodeURIComponent(sharedText)}`);
  await expect(page.locator("#map canvas")).toBeVisible();
  await openImportSheet(page);

  const input = page.locator("#chronomap-import-input");
  await input.fill(sharedText);
  await page.locator("[data-import-action='open']").click();

  await expect(page.locator(".import-sheet [role='alert']")).toContainText("使える座標");
  await expect(input).toHaveValue(sharedText);
  await expect(page.locator(".bottom-sheet[role='dialog']")).toBeVisible();
  expect(foreignRequests).toEqual([]);
  assertNoUnstubbedRequests(page);
});

test("A8 sends no Referer when the stubbed Wikipedia attribution link is opened", async ({
  page,
}) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  await expect(page.locator("#map canvas")).toBeVisible();
  await page.locator(".layer-info-badge").click();

  const link = page.locator("[data-layer-row='poi'] a");
  await expect(link).toHaveText("Wikipedia (CC BY-SA)");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const documentReferrerPolicy = await page
    .locator('meta[name="referrer"]')
    .getAttribute("content");
  expect(documentReferrerPolicy).toBe("no-referrer");

  const actualHref = await link.getAttribute("href");
  expect(actualHref).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
  await link.evaluate((element) => element.setAttribute("target", "_self"));
  const actualTarget = actualHref;
  if (actualTarget === null) throw new Error("Expected the POI attribution href.");
  await page.route(actualTarget, (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: "stubbed attribution page" }),
  );

  const requestPromise = page.waitForRequest((request) => request.url() === actualTarget);
  await link.click();
  const request = await requestPromise;
  expect(request.headers().referer ?? "").toBe("");
  assertNoUnstubbedRequests(page);
});

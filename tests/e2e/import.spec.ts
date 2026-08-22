import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type DebugState = {
  view: { lat: number; lng: number; zoom: number };
};

type DebugWindow = Window & {
  __chronomapDebug?: {
    getState(): DebugState;
    getMapView(): DebugState["view"];
  };
};

async function openImportSheet(page: Page): Promise<void> {
  await page.locator(".menu-trigger").click();
  await page.locator("[data-menu-item='import']").click();
  await expect(page.locator(".bottom-sheet[role='dialog']")).toBeVisible();
}

async function readView(page: Page): Promise<DebugState["view"]> {
  return page.evaluate(() => {
    const debug = (window as DebugWindow).__chronomapDebug;
    if (debug === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return debug.getState().view;
  });
}

async function readMapView(page: Page): Promise<DebugState["view"]> {
  return page.evaluate(() => {
    const debug = (window as DebugWindow).__chronomapDebug;
    if (debug === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return debug.getMapView();
  });
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("opens from the menu and focuses the import input", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();

  await openImportSheet(page);
  await expect(page.locator("#chronomap-import-input")).toBeFocused();
  await expect(page.locator("#chronomap-import-input")).toHaveAttribute("maxlength", "4096");
  assertNoUnstubbedRequests(page);
});

test("opens an Apple Maps URL, moves the map, closes the sheet, and shows a toast", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await openImportSheet(page);

  await page
    .locator("#chronomap-import-input")
    .fill("https://maps.apple.com/?ll=35.681236,139.767125&q=Tokyo");
  await page.locator("[data-import-action='open']").click();

  await expect(page.locator(".bottom-sheet[role='dialog']")).toHaveCount(0);
  await expect
    .poll(async () => await readView(page))
    .toEqual({
      lat: 35.681236,
      lng: 139.767125,
      zoom: 16,
    });
  await expect
    .poll(async () => await readMapView(page))
    .toEqual({
      lat: 35.681236,
      lng: 139.767125,
      zoom: 16,
    });
  await expect(page.locator(".toast")).toContainText("場所を開きました");
  assertNoUnstubbedRequests(page);
});

test("keeps a shortlink editable and shows shortlink guidance", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await openImportSheet(page);

  const input = page.locator("#chronomap-import-input");
  const value = "https://maps.app.goo.gl/example";
  await input.fill(value);
  await page.locator("[data-import-action='open']").click();

  await expect(page.locator("[role='alert']")).toContainText("短縮リンク");
  await expect(input).toHaveValue(value);
  await expect(page.locator(".bottom-sheet[role='dialog']")).toBeVisible();
  assertNoUnstubbedRequests(page);
});

test("does not submit an IME-composing Enter", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await openImportSheet(page);

  const input = page.locator("#chronomap-import-input");
  await input.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        isComposing: true,
      }),
    );
  });

  await expect(page.locator(".bottom-sheet[role='dialog']")).toBeVisible();
  await expect(page.locator(".import-sheet [role='alert']")).toBeHidden();
  assertNoUnstubbedRequests(page);
});

import { expect, test, type Page } from "@playwright/test";

import gsiLayers from "../../src/providers/layers/gsi.layers.json" with { type: "json" };
import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type DebugState = {
  year: number;
  geo: { status: string };
};

type DebugStyle = {
  layers: Array<{ id: string; paint?: { "raster-opacity"?: number } }>;
};

type E2eWindow = Window & {
  __chronomapDebug?: {
    getState(): DebugState;
    getMapView(): { lat: number; lng: number; zoom: number };
    getStyle(): DebugStyle;
    setView(view: { lat: number; lng: number; zoom: number }): void;
    setOverlayLayer(entry: unknown): void;
  };
  __chronomapPointerEvents?: number;
};

type Rect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

const GAZO_LAYER = gsiLayers.find((entry) => entry.id === "gsi-gazo1");
if (GAZO_LAYER === undefined) throw new Error("Expected the GSI gazo1 registry entry.");

async function tabUntil(
  page: Page,
  selector: string,
  direction: "forward" | "backward" = "forward",
): Promise<void> {
  const key = direction === "forward" ? "Tab" : "Shift+Tab";
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press(key);
    if (
      await page.evaluate((target) => document.activeElement?.matches(target) ?? false, selector)
    ) {
      return;
    }
  }
  throw new Error(`Could not reach ${selector} with ${direction} tab navigation.`);
}

async function readState(page: Page): Promise<DebugState> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState();
  });
}

async function readPastStyle(page: Page): Promise<DebugStyle> {
  const style = await page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getStyle();
  });
  return style as DebugStyle;
}

async function rectFor(page: Page, selector: string): Promise<Rect> {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("completes the keyboard journey and exposes settled year/layer announcements", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let pointerEvents = 0;
    document.addEventListener("pointerdown", () => {
      pointerEvents += 1;
    });
    Object.defineProperty(window, "__chronomapPointerEvents", {
      configurable: true,
      get: () => pointerEvents,
    });
  });
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({
    latitude: 35.681236,
    longitude: 139.767125,
    accuracy: 35,
  });
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");

  const slider = page.locator("[role='slider']");
  await expect(slider).toBeVisible();
  await tabUntil(page, "[role='slider']");
  await expect(slider).toBeFocused();
  await expect(slider).toHaveCSS("outline-style", "solid");
  await expect(slider).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "1966");
  const announcer = page.locator("[data-a11y-announcer='true']");
  await expect(announcer).toHaveAttribute("role", "status");
  await expect(announcer).toHaveAttribute("aria-live", "polite");
  await expect(announcer).toHaveAttribute("aria-atomic", "false");
  await expect(page.locator("[data-a11y-year-announcement='true']")).toContainText("1966");
  await slider.press("PageUp");
  await expect(page.locator("[data-a11y-layer-announcement='true']")).toContainText(
    "表示レイヤーが",
  );

  await tabUntil(page, "button.locate-button", "backward");
  const locate = page.locator("button.locate-button");
  await expect(locate).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(locate).toHaveAttribute("data-state", "granted");
  await expect.poll(async () => (await readState(page)).geo.status).toBe("granted");

  await tabUntil(page, ".layer-info-badge");
  const badge = page.locator(".layer-info-badge");
  await expect(badge).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.locator(".bottom-sheet[role='dialog']");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".bottom-sheet__close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(badge).toBeFocused();
  await expect(page.locator("[data-a11y-layer-announcement='true']")).toContainText(
    "表示レイヤーが",
  );

  const pointerEvents = await page.evaluate(
    () => (window as E2eWindow).__chronomapPointerEvents ?? -1,
  );
  expect(pointerEvents).toBe(0);
  assertNoUnstubbedRequests(page);
});

test("keeps interactive touch targets at or above 44px", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");

  for (const selector of [
    "button.locate-button",
    ".poi-toggle__button",
    ".menu-trigger",
    ".time-slider",
    ".time-slider__thumb-hit",
    ".layer-info-badge",
  ]) {
    const rect = await rectFor(page, selector);
    expect(rect.width, selector).toBeGreaterThanOrEqual(44);
    expect(rect.height, selector).toBeGreaterThanOrEqual(44);
  }

  const badge = page.locator(".layer-info-badge");
  await badge.press("Enter");
  const closeRect = await rectFor(page, ".bottom-sheet__close");
  expect(closeRect.width).toBeGreaterThanOrEqual(44);
  expect(closeRect.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");

  const toastAction = await page.evaluate(() => {
    const action = document.createElement("button");
    action.className = "sw-update-toast__action";
    action.textContent = "更新";
    document.body.append(action);
    const style = getComputedStyle(action);
    const rect = action.getBoundingClientRect();
    const result = {
      height: rect.height,
      minHeight: style.minHeight,
      minWidth: style.minWidth,
      width: rect.width,
    };
    action.remove();
    return result;
  });
  expect(toastAction.minWidth).toBe("44px");
  expect(toastAction.minHeight).toBe("44px");
  expect(toastAction.width).toBeGreaterThanOrEqual(44);
  expect(toastAction.height).toBeGreaterThanOrEqual(44);
  assertNoUnstubbedRequests(page);
});

test("keeps the shell usable at a 200% equivalent CSS viewport", async ({ page }) => {
  await page.setViewportSize({ width: 195, height: 422 });
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");

  for (const selector of [
    "button.locate-button",
    ".poi-toggle__button",
    ".menu-trigger",
    ".time-slider",
    ".layer-info-badge",
  ]) {
    await expect(page.locator(selector)).toBeVisible();
    const rect = await rectFor(page, selector);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(195);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(422);
  }

  const menu = page.locator(".menu-trigger");
  await menu.press("Enter");
  const menuRect = await rectFor(page, ".menu-popover");
  expect(menuRect.left).toBeGreaterThanOrEqual(0);
  expect(menuRect.right).toBeLessThanOrEqual(195);
  const documentBounds = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(documentBounds.scrollWidth).toBeLessThanOrEqual(documentBounds.clientWidth);
  await page.keyboard.press("Escape");

  const badge = page.locator(".layer-info-badge");
  await badge.press("Enter");
  const dialogRect = await rectFor(page, ".bottom-sheet[role='dialog']");
  expect(dialogRect.left).toBeGreaterThanOrEqual(0);
  expect(dialogRect.right).toBeLessThanOrEqual(195);
  expect(dialogRect.bottom).toBeLessThanOrEqual(422);
  await page.keyboard.press("Escape");
  assertNoUnstubbedRequests(page);
});

test("disables map and sheet motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  await expect(page.locator("#map canvas")).toBeVisible();

  const targetView = { lat: 34.6937, lng: 135.5023, zoom: 13 };
  await page.evaluate((view) => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setView(view);
  }, targetView);
  await expect
    .poll(async () => {
      const view = await page.evaluate(() => {
        const hook = (window as E2eWindow).__chronomapDebug;
        if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
        return hook.getMapView();
      });
      return [view.lat, view.lng, view.zoom];
    })
    .toEqual([targetView.lat, targetView.lng, targetView.zoom]);

  await page.evaluate((entry) => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setOverlayLayer(entry);
  }, GAZO_LAYER);

  await expect
    .poll(async () => {
      const style = await readPastStyle(page);
      return style.layers
        .filter((layer) => layer.id.startsWith("chronomap-past-"))
        .map((layer) => ({ id: layer.id, opacity: layer.paint?.["raster-opacity"] }));
    })
    .toEqual([{ id: "chronomap-past-gsi-gazo1", opacity: 1 }]);

  const badge = page.locator(".layer-info-badge");
  await badge.press("Enter");
  await expect(page.locator(".bottom-sheet")).toHaveCSS("transition-duration", "0s");
  await page.keyboard.press("Escape");
  assertNoUnstubbedRequests(page);
});

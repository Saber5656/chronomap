import { expect, test } from "@playwright/test";

import gsiLayers from "../../src/providers/layers/gsi.layers.json" with { type: "json" };
import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const OLD_LAYER = gsiLayers.find((entry) => entry.id === "gsi-ort-old10");
if (OLD_LAYER === undefined) throw new Error("Expected the GSI 1961–1969 registry entry.");

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("shows active and basemap attribution, then closes on Android back", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");

  const badge = page.locator(".layer-info-badge");
  await expect(badge).toContainText("1961–1969");
  await expect(badge).toContainText("空中写真 1961–1969年");
  await badge.click();

  const dialog = page.locator(".bottom-sheet[role='dialog']");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-layer-row='basemap']")).toContainText("GSI 淡色地図");
  await expect(dialog.locator("[data-layer-row='active-layer']")).toContainText(
    "空中写真 1961–1969年",
  );
  await expect(dialog.locator("[data-layer-row='active-layer']")).toContainText(
    OLD_LAYER.attribution.text,
  );
  const activeLinks = dialog.locator("[data-layer-row='active-layer'] a");
  await expect(activeLinks).toHaveCount(2);
  await expect(activeLinks.nth(0)).toHaveAttribute("href", OLD_LAYER.attribution.url);
  await expect(activeLinks.nth(0)).toHaveAttribute("target", "_blank");
  await expect(activeLinks.nth(0)).toHaveAttribute("rel", "noopener noreferrer");
  await expect(activeLinks.nth(1)).toHaveAttribute("href", OLD_LAYER.attribution.license.url);
  await expect(dialog.locator("[data-layer-row='poi']")).toContainText("Wikipedia (CC BY-SA)");

  await page.evaluate(() => history.back());
  await expect(dialog).toHaveCount(0);
  await expect(badge).toBeFocused();
  assertNoUnstubbedRequests(page);
});

test("shows present-day fallback with basemap and POI rows when no layer is active", async ({
  page,
}) => {
  await page.goto("/");
  const badge = page.locator(".layer-info-badge");
  await expect(badge).toHaveText("現在の地図");
  await badge.click();

  const dialog = page.locator(".bottom-sheet[role='dialog']");
  await expect(dialog.locator("[data-layer-row='basemap']")).toBeVisible();
  await expect(dialog.locator("[data-layer-row='poi']")).toBeVisible();
  await expect(dialog.locator("[data-layer-row='active-layer']")).toHaveCount(0);
  await expect(dialog.locator("[data-chip='experimental']")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("traps keyboard focus and closes with Escape", async ({ page }) => {
  await page.goto("/");
  const badge = page.locator(".layer-info-badge");
  await badge.click();

  const dialog = page.locator(".bottom-sheet[role='dialog']");
  const close = dialog.locator(".bottom-sheet__close");
  await expect(close).toBeFocused();
  await dialog.locator("a").last().focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(badge).toBeFocused();
  assertNoUnstubbedRequests(page);
});

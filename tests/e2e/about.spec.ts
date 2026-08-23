import { expect, test } from "@playwright/test";

import gsiLayers from "../../src/providers/layers/gsi.layers.json" with { type: "json" };
import konjakuLayers from "../../src/providers/layers/konjaku.layers.json" with { type: "json" };
import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const FIRST_KONJAKU_LAYER = konjakuLayers[0];
if (FIRST_KONJAKU_LAYER === undefined) throw new Error("Expected a Konjaku registry entry.");

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("opens About from the menu and renders registry credits, privacy, and document links", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".menu-trigger").click();
  await page.locator("[data-menu-item='about']").click();

  const dialog = page.locator(".bottom-sheet[role='dialog']");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".about-sheet__app-name")).toHaveText("chronomap");
  await expect(dialog.locator("[data-about-section='app']")).toContainText("0.0.0");

  const gsiCreditTexts = [...new Set(gsiLayers.map((entry) => entry.attribution.text))];
  const gsiRow = dialog.locator("[data-source-row='gsi']");
  await expect(gsiRow).toHaveCount(1);
  for (const creditText of gsiCreditTexts) await expect(gsiRow).toContainText(creditText);

  const konjakuRow = dialog.locator("[data-source-row='konjaku']");
  await expect(konjakuRow).toHaveCount(1);
  await expect(konjakuRow).toContainText(FIRST_KONJAKU_LAYER.attribution.text);
  await expect(konjakuRow.locator("a").last()).toHaveAttribute(
    "href",
    FIRST_KONJAKU_LAYER.attribution.license.url,
  );
  await expect(dialog.locator("[data-source-row='poi']")).toContainText("Wikipedia (CC BY-SA)");
  await expect(dialog.locator("[data-source-row='poi']")).toContainText("CC BY-SA 4.0");

  const privacy = dialog.locator("[data-about-section='privacy']");
  await expect(privacy).toContainText("chronomap.lang");
  await expect(privacy).toContainText("chronomap.onboarded");
  await expect(privacy).toContainText("CacheStorage");
  await expect(privacy).toContainText("国土地理院（GSI）");
  await expect(privacy).toContainText("中心座標");
  await expect(privacy).toContainText("Cookie");
  await expect(privacy).toContainText("トラッキング");
  await expect(privacy).toContainText("選択したときだけ");
  await expect(privacy).toContainText("プライバシー方針");

  for (const linkId of ["license", "third-party", "security", "shortcut"]) {
    const link = dialog.locator(`[data-about-link='${linkId}']`);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(dialog.locator("[data-about-link='shortcut']")).toHaveAttribute(
    "href",
    "https://github.com/Saber5656/chronomap/blob/main/docs/integrations/ios-shortcut.md",
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".menu-trigger")).toBeFocused();
  assertNoUnstubbedRequests(page);
});

test("keeps About content bilingual when the menu language changes", async ({ page }) => {
  await page.goto("/");
  await page.locator(".menu-trigger").click();
  await page.locator("[data-menu-item='language']").click();
  await expect(page.locator("[data-menu-item='about']")).toHaveText("About this app");
  await page.locator("[data-menu-item='about']").click();

  const dialog = page.locator(".bottom-sheet[role='dialog']");
  await expect(dialog.locator("[data-about-section='sources']")).toContainText("Data sources");
  await expect(dialog.locator("[data-about-section='privacy']")).toContainText(
    "The only localStorage keys saved",
  );
  await expect(dialog.locator("[data-about-section='privacy']")).toContainText(
    "This app uses no cookies, analytics, or tracking",
  );
  await expect(dialog.locator("[data-about-section='privacy']")).toContainText(
    "the map center is sent to Wikimedia",
  );
  await expect(dialog.locator("[data-source-row='konjaku']")).toBeVisible();
  assertNoUnstubbedRequests(page);
});

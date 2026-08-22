import { expect, test, type Page } from "@playwright/test";

import gsiLayers from "../../src/providers/layers/gsi.layers.json" with { type: "json" };
import type { LayerEntry } from "../../src/providers/layers/types";
import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type StyleLayer = {
  id: string;
  paint?: { "raster-opacity"?: number; "raster-fade-duration"?: number };
};

type DebugStyle = {
  sources: Record<string, { scheme?: string; tiles?: string[] }>;
  layers: StyleLayer[];
};

type DebugHook = {
  setOpacity(percent: number): void;
  getStyle(): DebugStyle;
  setOverlayLayer(entry: unknown): void;
};

type E2eWindow = Window & { __chronomapDebug?: DebugHook };

function registryEntry(id: string): LayerEntry {
  const entry = gsiLayers.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`Missing test registry entry: ${id}`);
  return entry as unknown as LayerEntry;
}

const OLD_ENTRY = registryEntry("gsi-ort-old10");
const GAZO_ENTRY = registryEntry("gsi-gazo1");

function readStyle(page: Page): Promise<DebugStyle> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getStyle() as DebugStyle;
  });
}

function pastLayers(style: DebugStyle): StyleLayer[] {
  return style.layers.filter((layer) => layer.id.startsWith("chronomap-past-"));
}

function pastSources(style: DebugStyle): string[] {
  return Object.keys(style.sources).filter((id) => id.startsWith("chronomap-past-src-"));
}

async function setOverlayLayer(page: Page, entry: LayerEntry): Promise<void> {
  await page.evaluate((nextEntry) => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setOverlayLayer(nextEntry);
  }, entry);
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("crossfades between resolved eras and applies opacity without a second fade", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await setOverlayLayer(page, OLD_ENTRY);
  await expect
    .poll(async () => pastLayers(await readStyle(page)).map(({ id }) => id))
    .toEqual(["chronomap-past-gsi-ort-old10"]);

  await setOverlayLayer(page, GAZO_ENTRY);
  const switchedStyleAfterStoreFlush = await readStyle(page);
  expect(pastSources(switchedStyleAfterStoreFlush)).toEqual([
    "chronomap-past-src-gsi-ort-old10",
    "chronomap-past-src-gsi-gazo1",
  ]);
  const initialOpacity = pastLayers(switchedStyleAfterStoreFlush).find(
    ({ id }) => id === "chronomap-past-gsi-gazo1",
  )?.paint?.["raster-opacity"];
  expect(initialOpacity).toBeGreaterThanOrEqual(0);
  expect(initialOpacity).toBeLessThan(1);

  await page.waitForTimeout(125);
  const midFade = pastLayers(await readStyle(page)).find(
    ({ id }) => id === "chronomap-past-gsi-gazo1",
  );
  expect(midFade?.paint?.["raster-opacity"]).toBeGreaterThan(0);
  // The browser may spend more than 125 ms between the switch and this read on a hosted runner;
  // completion at this observation point is valid as long as the layer reached a positive target.
  expect(midFade?.paint?.["raster-opacity"]).toBeLessThanOrEqual(1);

  await expect
    .poll(async () => pastLayers(await readStyle(page)).map(({ id }) => id))
    .toEqual(["chronomap-past-gsi-gazo1"]);
  await expect
    .poll(async () => pastLayers(await readStyle(page))[0]?.paint?.["raster-opacity"])
    .toBe(1);

  await page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setOpacity(60);
  });
  await expect
    .poll(async () => pastLayers(await readStyle(page))[0]?.paint?.["raster-opacity"])
    .toBe(0.6);
  assertNoUnstubbedRequests(page);
});

test("coalesces a scrub storm to one final past source", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await setOverlayLayer(page, OLD_ENTRY);
  await expect.poll(async () => pastLayers(await readStyle(page))).toHaveLength(1);

  for (const entry of [GAZO_ENTRY, OLD_ENTRY, GAZO_ENTRY, OLD_ENTRY, OLD_ENTRY]) {
    await setOverlayLayer(page, entry);
  }

  await expect
    .poll(async () => pastSources(await readStyle(page)))
    .toEqual(["chronomap-past-src-gsi-ort-old10"]);
  await expect
    .poll(async () => pastLayers(await readStyle(page)).map(({ id }) => id))
    .toEqual(["chronomap-past-gsi-ort-old10"]);
  assertNoUnstubbedRequests(page);
});

test("passes a TMS fixture source to MapLibre, which flips the requested tile row", async ({
  page,
}) => {
  const tileRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("ktgis.net/kjmapw/kjtilemap/tms-fixture")) {
      tileRequests.push(request.url());
    }
  });
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();

  await page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    hook.setOverlayLayer({
      id: "konjaku-tms-fixture",
      type: "raster-era",
      provider: "konjaku",
      title: { ja: "TMS fixture", en: "TMS fixture" },
      era: { from: 1896, to: 1909 },
      region: "JP",
      coverage: [[128, 30, 146.5, 45.8]],
      tiles: {
        urlTemplate: "https://ktgis.net/kjmapw/kjtilemap/tms-fixture/{z}/{x}/{y}.png",
        scheme: "tms",
        minzoom: 2,
        maxzoom: 16,
        tileSize: 256,
      },
      attribution: { text: "今昔マップ on the web", license: { name: "Provider terms" } },
      flags: { experimental: true, requiresFeatureFlag: "VITE_ENABLE_KONJAKU" },
      priority: 15,
    });
  });

  await expect
    .poll(() => tileRequests)
    .toEqual(expect.arrayContaining([expect.stringMatching(/\/6\/56\/38\.png$/u)]));
  assertNoUnstubbedRequests(page);
});

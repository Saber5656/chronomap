import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type DebugStyleLayer = {
  id: string;
  paint?: { "raster-opacity"?: number };
};

type DebugStyle = {
  layers: DebugStyleLayer[];
};

type OpacityState = {
  timeLayer: {
    activeLayerId: string | null;
    opacity: number;
  };
};

type DebugHook = {
  getState(): OpacityState;
  getStyle(): DebugStyle;
};

type E2eWindow = Window & { __chronomapDebug?: DebugHook };

async function readState(page: Page): Promise<OpacityState> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState();
  });
}

async function readPastOpacity(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    const style = hook.getStyle() as DebugStyle;
    const layer = style.layers.find(({ id }) => id.startsWith("chronomap-past-"));
    return layer?.paint?.["raster-opacity"] ?? null;
  });
}

async function expectUrlOpacity(page: Page, expected: string | null): Promise<void> {
  await expect.poll(() => new URL(page.url()).searchParams.get("op")).toBe(expected);
}

async function openOpacityPopover(page: Page): Promise<void> {
  const trigger = page.locator(".opacity-control__trigger");
  const bounds = await trigger.boundingBox();
  if (bounds === null) throw new Error("Expected a measurable opacity control.");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await expect(page.locator(".opacity-control__popover")).toBeVisible();
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("cycles overlay paint opacity and reflects the settled op URL", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect.poll(() => readPastOpacity(page)).toBe(1);

  const trigger = page.locator(".opacity-control__trigger");
  await expect(trigger).toBeEnabled();
  await expect(trigger).toHaveAttribute("aria-valuetext", /100%/u);
  const triggerMetrics = await trigger.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(triggerMetrics.scrollWidth).toBeLessThanOrEqual(triggerMetrics.clientWidth);

  await trigger.click();
  await expect.poll(() => readPastOpacity(page)).toBe(0.6);
  await expect.poll(async () => (await readState(page)).timeLayer.opacity).toBe(0.6);
  await expectUrlOpacity(page, "60");

  await trigger.click();
  await expect.poll(() => readPastOpacity(page)).toBe(0);
  await expect.poll(async () => (await readState(page)).timeLayer.opacity).toBe(0);
  await expectUrlOpacity(page, "0");
  await expect.poll(async () => (await readState(page)).timeLayer.activeLayerId).not.toBeNull();

  await trigger.click();
  await expect.poll(() => readPastOpacity(page)).toBe(1);
  await expectUrlOpacity(page, null);
  await expect(trigger).toHaveAttribute("aria-label", /100%/u);
  assertNoUnstubbedRequests(page);
});

test("boots from op=60 and sets 25% through the vertical long-press slider", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965&op=60");
  await expect(page.locator("#map canvas")).toBeVisible();
  const trigger = page.locator(".opacity-control__trigger");
  await expect(trigger).toHaveAttribute("aria-valuetext", /60%/u);
  await expect.poll(async () => (await readState(page)).timeLayer.opacity).toBe(0.6);
  await expect.poll(() => readPastOpacity(page)).toBe(0.6);

  await openOpacityPopover(page);
  const slider = page.locator(".opacity-control__slider");
  await expect(slider).toHaveAttribute("aria-orientation", "vertical");
  const bounds = await slider.boundingBox();
  if (bounds === null) throw new Error("Expected a measurable opacity mini-slider.");

  const x = bounds.x + bounds.width / 2;
  // Native range controls reserve a small thumb radius at both ends of the track; this point in
  // the control box lands on the documented 25% step after the browser rounds to step=5.
  const y = bounds.y + bounds.height * 0.725;
  await page.mouse.move(x, bounds.y + bounds.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator(".opacity-control__popover")).toBeHidden();
  await expect.poll(async () => (await readState(page)).timeLayer.opacity).toBe(0.25);
  await expect.poll(() => readPastOpacity(page)).toBe(0.25);
  await expectUrlOpacity(page, "25");

  await trigger.focus();
  await trigger.press("ArrowUp");
  await expect(page.locator(".opacity-control__popover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".opacity-control__popover")).toBeHidden();

  await openOpacityPopover(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".opacity-control__popover")).toBeHidden();

  await openOpacityPopover(page);
  const mapBounds = await page.locator("#map canvas").boundingBox();
  if (mapBounds === null) throw new Error("Expected a measurable map canvas.");
  await page.mouse.click(mapBounds.x + 20, mapBounds.y + 20);
  await expect(page.locator(".opacity-control__popover")).toBeHidden();
  assertNoUnstubbedRequests(page);
});

test("keeps the control disabled when the resolved layer is absent", async ({ page }) => {
  await page.goto("/?lat=0&lng=0&z=5&year=1965");
  const trigger = page.locator(".opacity-control__trigger");
  await expect(trigger).toBeDisabled();
  await expect(trigger).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".opacity-control")).toHaveAttribute("data-disabled", "true");
  assertNoUnstubbedRequests(page);
});

import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type SliderState = {
  year: number;
  timeLayer: {
    activeLayerId: string | null;
    resolution: { reason: string; candidates: string[] };
  };
};

type DebugHook = { getState(): SliderState };
type E2eWindow = Window & { __chronomapDebug?: DebugHook };

async function readState(page: Page): Promise<SliderState> {
  return page.evaluate(() => {
    const hook = (window as E2eWindow).__chronomapDebug;
    if (hook === undefined) throw new Error("Expected the VITE_E2E debug hook.");
    return hook.getState();
  });
}

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("renders the year range, ARIA state, and keyboard era navigation", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");

  const slider = page.locator("[role='slider']");
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute("aria-orientation", "horizontal");
  await expect(slider).toHaveAttribute("aria-valuemin", "1890");
  await expect(slider).toHaveAttribute("aria-valuemax", "2026");
  await expect(slider).toHaveAttribute("aria-valuenow", "1965");
  await expect(slider).toHaveAttribute("aria-valuetext", /1965年/u);

  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "1890");
  // Tokyo has a later spatially covered era, so the resolver reports an honest nearest-era snap
  // rather than `no-coverage`; the no-coverage branch is covered by the component unit test.
  await expect
    .poll(async () => (await readState(page)).timeLayer.resolution.reason)
    .toBe("ok");

  await slider.press("PageUp");
  await expect(slider).toHaveAttribute("aria-valuenow", "1928");
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "2026");
  await expect.poll(async () => (await readState(page)).year).toBe(2026);
  assertNoUnstubbedRequests(page);
});

test("updates the label live and commits a pointer drag after the settle debounce", async ({
  page,
}) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1950");

  const slider = page.locator("[role='slider']");
  const track = slider.locator(".time-slider__track");
  const bounds = await track.boundingBox();
  if (bounds === null) throw new Error("Expected a measurable slider track.");

  const targetYear = 1965;
  const targetX = bounds.x + bounds.width * ((targetYear - 1890) / (2026 - 1890));
  const targetY = bounds.y + bounds.height / 2;
  await page.mouse.move(targetX, targetY);
  await page.mouse.down();
  await expect(slider).toHaveAttribute("aria-valuenow", String(targetYear));
  await expect(slider.locator(".time-slider__value")).toContainText("1965年");
  await page.mouse.up();

  await expect.poll(async () => (await readState(page)).year).toBe(targetYear);
  await expect.poll(() => new URL(page.url()).searchParams.get("year")).toBe(String(targetYear));
  assertNoUnstubbedRequests(page);
});

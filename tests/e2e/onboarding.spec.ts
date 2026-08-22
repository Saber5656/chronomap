import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

const ONBOARDING_KEY = "chronomap.onboarded";
const ONBOARDING_RESET_MARKER = "chronomap.e2e.onboarding-reset";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, marker }) => {
      if (sessionStorage.getItem(marker) === "1") return;
      localStorage.removeItem(key);
      sessionStorage.setItem(marker, "1");
    },
    { key: ONBOARDING_KEY, marker: ONBOARDING_RESET_MARKER },
  );
  await stubUpstream(page, { onboarding: "first-visit" });
});

async function readOnboardingFlag(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), ONBOARDING_KEY);
}

async function waitForCoach(page: Page): Promise<void> {
  await expect(page.locator(".onboarding-coach")).toBeVisible();
  await expect(page.locator("[data-onboarding-next]")).toBeFocused();
}

test("walks through all three real controls, persists completion, and stays inside the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await waitForCoach(page);

  await expect(page.locator("[data-onboarding-progress]")).toHaveText("1 / 3");
  await expect(page.locator("[data-onboarding-scrim]")).toHaveCount(4);
  await expect(page.locator("[data-onboarding-message]")).toHaveText("スライダーで年代を移動");

  const viewport = page.viewportSize();
  const popover = await page.locator("[data-onboarding-popover]").boundingBox();
  const sliderDock = await page.locator(".slider-dock").boundingBox();
  if (viewport === null || popover === null || sliderDock === null) {
    throw new Error("Expected onboarding and slider dock bounds.");
  }
  expect(popover.x).toBeGreaterThanOrEqual(0);
  expect(popover.y).toBeGreaterThanOrEqual(0);
  expect(popover.x + popover.width).toBeLessThanOrEqual(viewport.width);
  expect(popover.y + popover.height).toBeLessThanOrEqual(sliderDock.y);

  await page.locator("[data-onboarding-next]").click();
  await expect(page.locator(".onboarding-coach")).toHaveAttribute(
    "data-onboarding-step-id",
    "locate",
  );
  await expect(page.locator("[data-onboarding-message]")).toHaveText("現在地から時間旅行を始める");

  await page.locator("[data-onboarding-next]").click();
  await expect(page.locator(".onboarding-coach")).toHaveAttribute(
    "data-onboarding-step-id",
    "menu",
  );
  await expect(page.locator("[data-onboarding-skip]")).toBeHidden();
  await expect(page.locator("[data-onboarding-message]")).toHaveText(
    "リンク共有や貼り付けはこちら",
  );

  await page.locator("[data-onboarding-next]").click();
  await expect.poll(() => readOnboardingFlag(page)).toBe("1");
  await expect(page.locator(".onboarding-coach")).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect(page.locator(".onboarding-coach")).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("supports Enter progression, Escape skip, and reduced-motion static highlights", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await waitForCoach(page);

  await expect(page.locator(".onboarding-target")).toHaveCSS("animation-name", "none");
  await page.locator("[data-onboarding-next]").press("Enter");
  await expect(page.locator(".onboarding-coach")).toHaveAttribute(
    "data-onboarding-step-id",
    "locate",
  );
  await page.locator("[data-onboarding-next]").press("Enter");
  await expect(page.locator(".onboarding-coach")).toHaveAttribute(
    "data-onboarding-step-id",
    "menu",
  );
  await page.keyboard.press("Escape");

  await expect.poll(() => readOnboardingFlag(page)).toBe("1");
  await expect(page.locator(".onboarding-coach")).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("marks deep-link entry complete without showing the coach", async ({ page }) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect.poll(() => readOnboardingFlag(page)).toBe("1");
  await expect(page.locator(".onboarding-coach")).toHaveCount(0);
  assertNoUnstubbedRequests(page);
});

test("dismisses on a map pan during the locate step while leaving the map interactive", async ({
  page,
}) => {
  await page.goto("/");
  await waitForCoach(page);
  await page.locator("[data-onboarding-next]").click();
  await expect(page.locator(".onboarding-coach")).toHaveAttribute(
    "data-onboarding-step-id",
    "locate",
  );

  const map = await page.locator("#map canvas").boundingBox();
  if (map === null) throw new Error("Expected map canvas bounds.");
  const startX = map.x + map.width / 2;
  const startY = map.y + map.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 60, startY + 20, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator(".onboarding-coach")).toHaveCount(0);
  await expect.poll(() => readOnboardingFlag(page)).toBe("1");
  assertNoUnstubbedRequests(page);
});

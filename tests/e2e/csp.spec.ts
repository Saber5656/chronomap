import { expect, test, type Page } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

type CspViolation = {
  blockedURI: string;
  effectiveDirective: string;
  violatedDirective: string;
};

type CspWindow = Window & {
  __chronomapCspViolations?: CspViolation[];
};

async function installViolationRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: CspViolation[] = [];
    Object.defineProperty(window, "__chronomapCspViolations", {
      configurable: true,
      value: violations,
    });
    window.addEventListener("securitypolicyviolation", (event) => {
      violations.push({
        blockedURI: event.blockedURI,
        effectiveDirective: event.effectiveDirective,
        violatedDirective: event.violatedDirective,
      });
    });
  });
}

async function readViolations(page: Page): Promise<CspViolation[]> {
  return page.evaluate(() => (window as CspWindow).__chronomapCspViolations ?? []);
}

test.beforeEach(async ({ page }) => {
  await installViolationRecorder(page);
  await stubUpstream(page, { passthroughHosts: ["evil.example"] });
});

test("keeps MapLibre, overlay, slider, picker, and menu journeys violation-free", async ({
  page,
}) => {
  await page.goto("/?lat=35.681236&lng=139.767125&z=16&year=1965");
  await expect(page.locator("#map canvas")).toBeVisible();

  const slider = page.locator("[role='slider']");
  const initialYear = await slider.getAttribute("aria-valuenow");
  await slider.press("PageUp");
  await expect.poll(async () => slider.getAttribute("aria-valuenow")).not.toBe(initialYear);
  await page.locator(".menu-trigger").click();
  await expect(page.locator(".menu-popover")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect.poll(async () => (await readViolations(page)).length).toBe(0);
  assertNoUnstubbedRequests(page);
});

test("blocks injected images and cross-origin fetches to an evil host", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();

  const result = await page.evaluate(async () => {
    const image = document.createElement("img");
    image.alt = "CSP negative test";
    const imageBlocked = new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(true), 250);
      image.onload = () => {
        window.clearTimeout(timeout);
        resolve(false);
      };
      image.onerror = () => {
        window.clearTimeout(timeout);
        resolve(true);
      };
    });
    document.body.append(image);
    image.src = "https://evil.example/x.png";

    let fetchRejected = false;
    try {
      await fetch("https://evil.example", { mode: "no-cors" });
    } catch {
      fetchRejected = true;
    }

    const blockedImage = await imageBlocked;
    return {
      blockedImage,
      fetchRejected,
      violations: (window as CspWindow).__chronomapCspViolations ?? [],
    };
  });

  expect(result.blockedImage).toBe(true);
  expect(result.fetchRejected).toBe(true);
  expect(result.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        blockedURI: expect.stringContaining("evil.example"),
        effectiveDirective: "img-src",
      }),
      expect.objectContaining({
        blockedURI: expect.stringContaining("evil.example"),
        effectiveDirective: "connect-src",
      }),
    ]),
  );
  assertNoUnstubbedRequests(page);
});

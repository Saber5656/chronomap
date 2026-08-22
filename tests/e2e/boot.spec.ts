import { expect, test } from "@playwright/test";

import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

test.beforeEach(async ({ page }) => {
  await stubUpstream(page);
});

test("boot smoke @smoke", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#map")).toBeVisible();
  await expect(page.locator("#map canvas")).toBeVisible();
  expect(consoleErrors, "The boot smoke test emitted console errors.").toEqual([]);
  assertNoUnstubbedRequests(page);
});

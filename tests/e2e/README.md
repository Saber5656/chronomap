# E2E harness

Playwright specs use the shared network harness so tests never call GSI, Konjaku, Wikipedia, or
Wikimedia. Provider routes return committed fixtures; every other cross-origin request is aborted
and reported by `assertNoUnstubbedRequests`.

The mobile Chromium project is the CI gate. The WebKit project runs only specs whose title
contains `@smoke`; install WebKit locally before running that project.

```ts
import { expect, test } from "@playwright/test";
import { assertNoUnstubbedRequests, stubUpstream } from "./stubs/network";

test.beforeEach(async ({ page }) => stubUpstream(page));

test("provider-backed flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#app")).toBeVisible();
  assertNoUnstubbedRequests(page);
});
```

Use `stubUpstream(page, { missing: [{ layerId: "ort_1928", zoom: 13 }] })` when a spec needs a
deterministic missing tile response. For a local WebKit smoke run:
`npx playwright install webkit && npm run e2e -- --project=webkit-smoke`.

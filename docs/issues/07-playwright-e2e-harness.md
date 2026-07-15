# Title

Set up Playwright e2e harness with full network stubbing (tiles + Wikimedia)

## Summary

Add Playwright with a mobile-first project config and reusable stubbing helpers so every e2e test
runs with zero real upstream traffic, plus a boot smoke test and the CI step.

## Context

DESIGN §15: CI must never depend on GSI/Wikimedia availability, and tests must not send load to
public services. All later e2e specs (issues 12, 19, 28, 35, 43…) build on these helpers.

## Scope

- Dev dep `@playwright/test`; `playwright.config.ts`: projects `mobile-chromium`
  (Pixel-class viewport 390×844, touch, `geolocation` permission granted, locale `ja-JP`) and
  `webkit-smoke` (same viewport, tagged `@smoke` specs only); `webServer` command builds before
  previewing, e.g. `npm run build && npm run preview`, with `reuseExistingServer`.
- `tests/e2e/stubs/network.ts` exporting `stubUpstream(page)`:
  - `**cyberjapandata.gsi.go.jp/**` and `**ktgis.net/**` → fulfill 256×256 checkerboard PNG
    (committed fixture `tests/e2e/stubs/tile.png`); optionally 404 for configured layer ids/zooms
    (`stubUpstream(page, { missing: [...] })`) to test coverage states.
  - `**wikipedia.org/w/api.php**` → canned geosearch JSON fixture;
    `**wikipedia.org/api/rest_v1/page/summary/**` → canned summary fixture;
    `**upload.wikimedia.org/**` → fixture thumbnail; `**commons.wikimedia.org/**` → canned JSON.
  - Any other cross-origin request → **abort + record**; helper `assertNoUnstubbedRequests()`.
- `tests/e2e/geolocation.ts`: `setFix(page, lat, lng, accuracy)` via `context.setGeolocation`.
- Spec `tests/e2e/boot.spec.ts`: app loads `/`, `#app` visible, map canvas element present,
  no unstubbed requests, no console errors.
- Scripts: `e2e` (`playwright test`), `e2e:ui`. CI: extend `ci.yml` verify job with
  `npx playwright install --with-deps chromium` + `npm run e2e -- --project=mobile-chromium`.

## Detailed Requirements

1. Stub helpers must be import-and-call (≤2 lines per spec) and documented in
   `tests/e2e/README.md` with one example.
2. The unstubbed-request recorder must fail the test on any real network egress attempt.
3. Keep webkit installed only when running `@smoke` locally; CI runs chromium only (time budget).

## Acceptance Criteria

- [ ] `npm run e2e` passes from a clean checkout against the built app with the network cable conceptually
      unplugged (all upstream stubbed).
- [ ] CI runs the chromium project green; artifacts (trace on failure) uploaded.
- [ ] `assertNoUnstubbedRequests` demonstrably fails when a stub is disabled (shown in PR, not committed).

## Validation

Local `npm run e2e`; CI run on the PR.

## Dependencies

01 (build), 04 (CI file to extend).

## Non-goals

Feature specs (arrive with their features), Lighthouse (46), device-lab testing (48 manual matrix).

## Design References

DESIGN §15; §7.1 (why no real API calls); ADR-005.

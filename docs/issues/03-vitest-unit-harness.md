# Title

Set up Vitest unit-test harness with fixtures convention

## Summary

Add Vitest with jsdom environment, coverage, the `tests/unit/` + `tests/unit/fixtures/` layout,
and one real example test, so every later issue can add unit tests without harness work.

## Context

DESIGN §15 places heavy weight on unit tests for pure modules (URL contract, parser, resolver,
validators). The harness and conventions must exist before those issues start.

## Scope

- Dev deps: `vitest`, `@vitest/coverage-v8`, `jsdom`.
- `vitest.config.ts`: environment `jsdom` (map/UI code touches DOM types), globals off (explicit
  imports), include `tests/unit/**/*.spec.ts`, coverage reporter `text` + `lcov`,
  thresholds: statements/branches/functions/lines ≥ 80% for `src/state`, `src/security`,
  `src/integrations`, `src/providers` (thresholds scoped via `coverage.include` — UI/map excluded).
- Layout: `tests/unit/<area>/<module>.spec.ts`; canned data in `tests/unit/fixtures/<area>/*.json`
  loaded via explicit `import`.
- Example: `tests/unit/util/geo.spec.ts` testing a real `src/util/geo.ts` implementation of
  `haversineMeters(a, b)` and `viewportDiagonalMeters(bbox)` (implement these two functions now —
  they are needed by §7.1).
- Script: `test` (`vitest run --coverage`), `test:watch`.

## Detailed Requirements

1. `haversineMeters`: standard haversine, Earth radius 6371008.8 m; `viewportDiagonalMeters`
   = haversine between bbox SW and NE corners. Both pure, typed, exported.
2. Example spec includes a known-distance case (Tokyo Sta. 35.681236,139.767125 → Shin-Osaka
   34.733,135.500 ≈ 403 km ± 1%).
3. Coverage thresholds must fail the run when unmet (verify by temporarily excluding the spec).

## Acceptance Criteria

- [ ] `npm run test` passes with coverage report; thresholds active for the four `src/` areas.
- [ ] Fixtures directory convention documented in `tests/unit/README.md` (5 lines).
- [ ] `src/util/geo.ts` implemented + tested as specified.

## Validation

`npm run test` locally; CI (04) runs it unchanged.

## Dependencies

01 (scaffold).

## Non-goals

E2E (07), fuzz/abuse suite (44), testing UI components.

## Design References

DESIGN §15, §7.1; ADR-002.

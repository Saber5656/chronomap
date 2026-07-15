# Title

Implement error/offline states and the Toast system

## Summary

Build the final `Toast` component and wire the DESIGN §13 degraded-state matrix: offline detection,
basemap failure notice, POI error pill with retry, and consistent timeout policy — replacing
interim toasts from earlier issues.

## Context

DESIGN §13 defines exact UX per failure. ADR-001 means upstream outages surface directly to the
client; calm, specific messaging is the difference between "broken" and "degraded".

## Scope

- `src/ui/components/Toast.ts` (final form; replaces 31's inline stub): single-slot queue (max 3
  pending, drop-oldest), kinds info/error, optional action button (used by 31's update toast),
  auto-dismiss 4 s (action toasts 8 s), `aria-live="polite"`, reduced-motion aware.
- Offline handling: `navigator.onLine` + `online/offline` events → store flag `ui.offline` (add
  to AppState; update 09 types): one-time toast `net.offline` (`オフラインのようです — 地図
  データは読み込めません`) on transition; badge dot on MenuButton while offline; `net.backOnline`
  info toast on recovery.
- Basemap tile failures (non-404 network errors > 10 within 10 s while online) → single toast
  `net.tilesFailing` (rate-limited: once per 5 min) — implement counter in mapController error
  listener (10).
- POI error pill (map-region top, below CoverageBanner): shown when `poi.status==='error'`:
  i18n `poi.fetchError` (`記事を取得できませんでした`) + `common.retry` button → re-trigger
  fetch (27 exposes `retry()`).
- Verify timeout policy: all fetches already use `AbortSignal.timeout(8000)` (24) — add a lint-
  level grep test (unit spec asserting no raw `fetch(` outside wikimediaClient/allowed files).

## Detailed Requirements

1. Toasts never stack visually (queue), never block map gestures, respect safe areas.
2. Offline flag must not disable UI (everything stays tappable; actions fail soft).
3. No auto-retry loops anywhere (manual retry only; §13).
4. Past-layer 404s remain silent (regression guard: e2e from 18/21 unaffected).

## Acceptance Criteria

- [ ] e2e: context.setOffline(true) → offline toast once + menu dot; setOffline(false) →
      recovery toast; no repeat spam on flapping (3 rapid toggles ≤ 2 offline toasts —
      hysteresis 5 s).
- [ ] e2e: POI 500 stub → pill + retry works (second stub succeeds) → pill clears.
- [ ] e2e: update-toast action path from 31 still works with final Toast.
- [ ] Unit: toast queue (order, drop-oldest, action timeout), offline hysteresis, tile-failure
      rate limiter (fake timers).

## Validation

`tests/e2e/errors.spec.ts` + unit specs.

## Dependencies

10, 19, 24, 27, 31 (integrations it finalizes). Updates 09 (state field).

## Non-goals

Error telemetry (never in v1), Sentry-like reporting, offline map data.

## Design References

DESIGN §13, §8 #12; ADR-001, ADR-005.

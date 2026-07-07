# Title

Wire URL ↔ state synchronization and share-current-view action

## Summary

Boot the app from URL params, keep the address bar updated (debounced `replaceState`), and add
the "share this view" menu action (copy link / Web Share API).

## Context

DESIGN §5.2 (write rules), §3.5. The URL is the app's only persistence and its main sharing
mechanism; deep links are the foundation the map-app integrations (W5) reuse.

## Scope

- `src/state/urlSync.ts`:
  - `initUrlSync(store, registryIds)`: (a) on boot, apply `parseUrlState(location.search, …)`
    over defaults (before map init — order per §4.2); (b) subscribe to `view`, `year`,
    `timeLayer.opacity`, `poi.enabled` and after 500 ms debounce call
    `history.replaceState(null, '', serialized)`; never `pushState` for view changes.
  - Respect the sheet-history integration (§8.3): view sync must use `replaceState` only, so it
    composes with sheet `pushState` from issue 28/36 without history spam.
- Share action (registered on MenuButton slot, menu itself is issue 33's context or MenuButton
  from §8 #11 — implement the minimal MenuButton here with a single "share view" item; later
  issues append items):
  - If `navigator.share` available: share `{ title: 'chronomap', url }`; else clipboard write +
    toast "リンクをコピーしました" (string via i18n key `share.copied`).
  - Shared URL = `location.origin + BASE_URL + serialized` current state.
- `src/app/onboardingHooks` NOT here (42).

## Detailed Requirements

1. Loading `/?lat=34.7025&lng=135.4959&z=16&year=1965` must land the camera there with year 1965
   applied before first layer resolution (no visible "jump").
2. URL updates must not occur while a share/import flow is mid-redirect (guard: skip sync until
   first `idle`).
3. Debounce must collapse a continuous pan into ≤ 1 history update per 500 ms silence.
4. MenuButton: accessible button (aria-label via i18n), popover list, Esc/outside-tap closes.

## Acceptance Criteria

- [ ] e2e: deep-link load → camera + slider reflect params; pan → after settle, `location.search`
      contains updated `lat/lng/z`; reload reproduces the view.
- [ ] e2e: share action with `navigator.share` stubbed absent → clipboard contains the exact
      current URL; toast visible.
- [ ] Unit: debounce behavior with fake timers.
- [ ] History length does not grow during pan/zoom (replaceState only).

## Validation

E2E `tests/e2e/deeplink.spec.ts` + unit tests for the sync module (jsdom history mock).

## Dependencies

10 (map), 11 (parser/serializer). i18n keys exist once 39 lands (executes earlier in W1 order —
see ISSUE_PLAN §2; if 39 is not yet merged, add keys to its pending table).

## Non-goals

Inbound `/share` route (35), outbound map-app links (32), sheet history handling (28/36).

## Design References

DESIGN §5.2, §3.5, §8 #11, §8.3, §4.2.

# Title

Implement geolocation module with locate button and permission UX

## Summary

Add user-gesture-only geolocation: LocateButton with four visual states, single-fix acquisition,
accuracy circle, camera fly-to, and denial/unavailable handling.

## Context

DESIGN §3.1 (flow), §13 (degraded states), ADR-005 rule 1 (no auto-prompt; location client-side
only). "現在地から過去を遡る" is the product's opening move — this must be smooth and private.

## Scope

- `src/map/geolocation.ts`:
  - `requestFix(): Promise<Fix>` wrapping `navigator.geolocation.getCurrentPosition` with
    `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }`; maps errors to
    `denied | unavailable | timeout`.
  - No `watchPosition` in v1 (battery + privacy-lean); "follow me" is out of scope.
  - Secure-context / API-absence check → `geo.status = 'unavailable'`.
- `src/ui/components/LocateButton.ts` (slot `controls-top`): states from `store.geo.status`:
  idle (crosshair icon) / requesting (spinner) / granted (filled icon) / denied (slashed icon).
  Tap when denied → small explainer popover: how to re-enable in browser settings (i18n keys
  `geo.denied.title/body`), no OS deep links (not possible from web).
- On success: `actions.setFix`, `mapController.flyToUser(fix)` (zoom 15, max duration 1.5 s,
  respect `prefers-reduced-motion` → jumpTo), draw accuracy circle + dot as a GeoJSON source
  (`chronomap-user`) with circle layers; circle radius = `fix.accuracyM` (geodesic approximation
  acceptable: circle paint radius via `metersToPixelsAtLat` helper from `util/geo.ts`, specified
  in issue 03).
- Fix marker is removed when a new deep link/share navigation replaces the view? No — keep until
  next fix or page reload (simplest consistent rule; document).

## Detailed Requirements

1. Zero geolocation API calls before the first button tap (assert in e2e via API spy).
2. The fix must never be written to URL, storage, or any network request (grep-able invariant;
   POI requests use map center per §7.1, which the user may move away from the fix).
3. Timeout → toast `geo.timeout` + status back to idle (retryable).
4. Button hit target ≥ 44px, `aria-label` i18n, `aria-pressed` semantics not used (action button).

## Acceptance Criteria

- [ ] e2e (fix stubbed 35.681,139.767): tap → camera lands z15 at fix; dot + accuracy circle
      rendered; `geo.status='granted'`.
- [ ] e2e denial path: permission denied → slashed icon + explainer popover opens on tap.
- [ ] e2e: network log contains no request with the fix coordinates (POI disabled in this spec).
- [ ] Unit: error mapping (`PERMISSION_DENIED`→denied etc.), `metersToPixelsAtLat`.

## Validation

`tests/e2e/geolocation.spec.ts` with Playwright geolocation fixtures (07); unit specs.

## Dependencies

10 (map fly-to), 08 (slot), 09 (state). i18n keys per 39 convention.

## Non-goals

Continuous tracking, heading/compass, background location, IP-based fallback location (never).

## Design References

DESIGN §3.1, §8 #5, §13; ADR-005 rules 1–2.

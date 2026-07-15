# Title

Implement outbound handoff to external map apps

## Summary

Implement `src/integrations/outbound.ts` (Google/Apple/geo: URL builders from validated coords)
and surface "open in map app" actions in the POI sheet and the long-press menu.

## Context

DESIGN §9.4 + research/map-app-integration.md §3. Reverse direction of the share-in flows; must be
injection-proof (abuse case A6: URLs built from numerics only, hosts hardcoded).

## Scope

- `outbound.ts`:
  ```ts
  buildGoogleMapsUrl(lat: number, lng: number): string   // https://www.google.com/maps/search/?api=1&query={lat}%2C{lng}
  buildAppleMapsUrl(lat: number, lng: number): string    // https://maps.apple.com/?ll={lat},{lng}
  buildGeoUri(lat: number, lng: number, zoom?: number): string  // geo:{lat},{lng}?z={int zoom}
  openExternal(url: string): void                        // window.open(url,'_blank','noopener,noreferrer')
  ```
  Inputs are validated store values; functions assert finite/range (throw on programmer error);
  coords fixed to 6 dp; NO string interpolation of any user text (labels never included).
- Action surface `showMapHandoffMenu(lat, lng)`: small action popover with three entries
  (i18n `handoff.google` / `handoff.apple` / `handoff.geo` — `地図アプリで開く…`); platform
  ordering: iOS → Apple first; Android → Google, geo; desktop → Google, Apple (UA-based ordering
  only, all always visible).
- Wire into: PoiSheet button (28's disabled placeholder → enable) and long-press menu (33 —
  export the menu component for reuse).

## Detailed Requirements

1. `geo:` entry hidden on iOS (no handler; research doc) — capability map documented in code.
2. `openExternal` only ever receives values from the three builders (lint-friendly: builders
   return branded type `OutboundUrl`, `openExternal(u: OutboundUrl)`).
3. No referrer leakage: rely on app-wide no-referrer meta (43) + noopener,noreferrer here.

## Acceptance Criteria

- [ ] Unit: exact-URL snapshots for the three builders (incl. negative coords, rounding);
      range assertion throws on lat 91.
- [ ] e2e: POI sheet → handoff menu → tapping Google entry calls window.open with the exact URL
      (stub window.open); popup blocked path shows copy-link fallback toast.
- [ ] Branded-type compilation test: passing a raw string to openExternal fails typecheck
      (type-level test via `// @ts-expect-error` spec).

## Validation

`npm run test` + `tests/e2e/handoff.spec.ts`.

## Dependencies

12 (menu infra/state), 28 (button slot). Blocks 33 (menu reuse).

## Non-goals

Inbound parsing (34), label forwarding to map apps (privacy/injection — never), other map vendors.

## Design References

DESIGN §9.4, §12.2 A6; research/map-app-integration.md §3.

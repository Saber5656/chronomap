# Title

Bootstrap MapLibre map with GSI basemap and store binding

## Summary

Initialize MapLibre GL JS in the shell's `#map` slot with the GSI `pale` raster basemap (`std` as
fallback constant), bind camera ↔ store `view`, and emit `moveend`/`idle`/long-press events.

## Context

DESIGN §6 (map), §4.2 boot step 5, research/gsi-tiles.md §1. This is the first visible product
feature; overlay manager (18) and POI layer (27) attach to this map instance.

## Scope

- `src/map/mapController.ts`:
  - `createMap(container, store): MapController` builds an inline MapLibre style: raster source
    `gsi-pale` (`https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png`, tileSize 256,
    minzoom 2 maxzoom 18 — overzoom beyond native 18 not needed; attribution string per
    research/gsi-tiles.md §3) + background layer.
  - Camera init from `store.get().view`; `maxZoom 18`, `minZoom 2`, `maxPitch 0`, rotation
    disabled (`dragRotate false`, `touchZoomRotate` without rotation) — v1 is north-up 2D.
  - Store binding: `moveend` → `actions.setView` (rounded per §12.3); external `view` changes
    (e.g. deep link, locate) → `map.jumpTo`/`flyTo` (flyTo only for locate; guard against feedback
    loops with an `isProgrammaticMove` flag).
  - Events out: `onIdle(cb)`, `onLongPress(cb: (lngLat) => void)` — long-press = pointerdown held
    600 ms with < 8px movement (touch) or `contextmenu` (desktop).
  - `MapController` exposes `getMap()` for overlay/poi modules, `getViewportBbox()`,
    `flyToUser(fix)`.
- MapLibre CSS imported once; attribution control bottom-left, compact.
- RTL/label plugins: none (v1).

## Detailed Requirements

1. The map must never initialize before the store exists; boot order per DESIGN §4.2.
2. Camera writes to store are rounded (lat/lng 6 dp, zoom 2 dp) to keep URL stable (§5.2).
3. No calls to geolocation APIs here (13 owns that).
4. Long-press must not fire during pan/zoom gestures (movement threshold) and must fire at most
   once per hold.

## Acceptance Criteria

- [ ] Dev app shows pale-map Japan; pan/zoom updates `store.view` (assert via test hook
      `window.__chronomapDebug.getState()` exposed only when `import.meta.env.DEV` or e2e flag).
- [ ] e2e: with stubbed tiles, map canvas renders; programmatic `setView` action moves camera;
      long-press fires callback with lngLat (touch emulation).
- [ ] Attribution control visible with GSI credit.
- [ ] No feedback loop: 20 rapid setView calls settle with exactly matching final state (unit-ish
      e2e assertion).

## Validation

E2E spec `tests/e2e/map.spec.ts` (stubbed tiles); manual visual check.

## Dependencies

08 (shell slot), 09 (store).

## Non-goals

Past-layer overlays (18), locate (13), URL sync (12), world basemap (v2 — research/world-providers.md §3).

## Design References

DESIGN §6, §4.2, §8 #2; research/gsi-tiles.md §1; ADR-002.

# Title

Implement raster overlay manager with crossfade

## Summary

Implement `src/map/overlayManager.ts`: mounts/unmounts the active past layer on the MapLibre map
with 250 ms crossfade, opacity control, TMS scheme support, and coalesced transitions.

## Context

DESIGN §6.2. This module is the only writer of past-layer sources/layers on the map; slider (19)
and resolution wiring drive it through the store.

## Scope

- `createOverlayManager(mapController, store) → { destroy(): void }`:
  - Subscribes to `timeLayer.activeLayerId` + `timeLayer.opacity`.
  - `setLayer(entry | null, opacity)`: source id `chronomap-past-src-{entryId}`, layer id
    `chronomap-past-{entryId}`; raster source from registry entry (`tiles: [urlTemplate]`,
    `scheme`, `minzoom/maxzoom` from `tiles.*`, `tileSize`, `attribution`); insert **below** the
    first symbol layer / above basemap and always below `chronomap-poi-*` and `chronomap-user`
    layers (define `beforeId` helper `firstLayerIdWithPrefix(map, 'chronomap-poi')`).
  - Crossfade: new layer starts `raster-opacity: 0` → rAF-animated to target over 250 ms
    (ease-out), then old source+layer removed. Only one transition in flight: a newer request
    cancels the animation, immediately finalizes removal of superseded layers, and starts the
    latest — no flicker, no orphan sources (assert via `map.getStyle().sources` count ≤ 2 past
    sources at any instant).
  - `prefers-reduced-motion` → skip animation (instant swap).
  - `setOpacity(v)`: `setPaintProperty(activeLayer, 'raster-opacity', v)` (no transition).
  - `raster-fade-duration: 0` on sources (we own the fade; avoids double-fading).
- Tile errors (404 out-of-coverage): rely on MapLibre default (missing tile = transparent); add
  an `error` listener filtering AJAX tile errors to debug log only — never toasts (§13).
- `destroy()`: unsubscribe from store listeners, remove map error listener, cancel any in-flight
  rAF transition, and remove owned past sources/layers without mutating a disposed map.

## Detailed Requirements

1. Layer/source ids and z-order rules exactly as above (tests reference them).
2. Rapid slider scrubbing (10 changes/s) must not leak sources/layers (e2e asserts final style
   has exactly one past source) and must end on the last requested layer.
3. Works with `scheme: "tms"` entries (Konjaku): requested tile y must be flipped by MapLibre —
   e2e stub asserts requested URL for a known viewport/zoom.
4. Null layer (no-coverage) → removes past layer entirely (basemap only).
5. Calling `destroy()` twice is safe and leaves no store subscriptions, map listeners, or animation
   callbacks active.

## Acceptance Criteria

- [ ] e2e (stubbed tiles): switching year across two eras crossfades (opacity samples via
      `getPaintProperty` at t≈0/125/300 ms); final opacity = store opacity.
- [ ] e2e scrub-storm test passes the no-leak assertion.
- [ ] e2e TMS URL assertion for a konjaku fixture entry (flag ON in test env only).
- [ ] Unit: transition state machine (idle→fading→idle, supersede path) extracted as a pure
      helper and tested with fake rAF; manager teardown test proves subscriptions/listeners/rAF are
      cleaned up.

## Validation

`tests/e2e/overlay.spec.ts` + unit for the transition helper.

## Dependencies

10 (map), 14 (entry types). 15 provides real entries (tests may use fixtures).

## Non-goals

Choosing the layer (17), slider UI (19), opacity UI (20), vector layers (v2).

## Design References

DESIGN §6.2, §13; research/gsi-tiles.md §2 (404 behavior), research/konjaku-map-tiles.md §2 (TMS).

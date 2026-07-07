# Title

Implement POI pin rendering layer and fetch trigger policy

## Summary

Implement `src/map/poiLayer.ts`: the map-idle-driven fetch controller (DESIGN §7.1 policy) and
GeoJSON pin rendering with selection state, plus the PoiToggle control.

## Context

This wires providers (25) to the map (10) under the strict politeness policy — max one in-flight
request, debounced, zoom-gated — and renders up to 50 pins without DOM markers (§7.2).

## Scope

- Fetch controller `initPoiController(mapController, store, provider)`:
  - Trigger on map `idle`; conditions (§7.1): `poi.enabled && zoom ≥ POI_MIN_ZOOM &&
    (centerMoved > 25% viewport diagonal since last fetch || radiusBucket changed)`.
  - Debounce 300 ms; `latestOnly()` wrapper (24); radius =
    `clamp(round(viewportDiagonalMeters/2), 100, 10000)`; locale from `ui.lang`.
  - Status transitions: `below-zoom` (zoom gate), `loading`, `ready`, `error` (§5.1) via actions.
  - Results diffed by id → `actions.setPoiItems` (stable order; keep selected item if still present,
    else clear selection).
- Rendering (map/poiLayer.ts render half):
  - GeoJSON source `chronomap-poi` + layers `chronomap-poi-circle` (fallback dot) and
    `chronomap-poi-symbol` (icon + optional name label at zoom ≥ 15, `text-optional: true`);
    above past overlay, below user-location layers (z-order per 18's helper).
  - Selection: `feature-state {selected}` → radius/color emphasis; map click on pin →
    `actions.selectPoi(id)` + `openSheet('poi')`; click elsewhere → clear selection (sheet stays,
    28 decides close behavior).
  - Pin icon: single bundled SVG sprite (add `public/icons/poi.svg` → loaded via `map.addImage`).
- `src/ui/components/PoiToggle.ts` (controls-top): toggles `poi.enabled`; when zoom <
  POI_MIN_ZOOM and enabled, shows the hint pill i18n `poi.zoomHint` (`ズームすると周辺の記事が
  出ます`) once per session (sessionStorage flag).

## Detailed Requirements

1. Exactly ≤ 1 network request per idle settle (spy-testable); pan storms coalesce.
2. Disabling POI aborts in-flight request, clears items + pins.
3. Locale change (39) invalidates items (clear + refetch on next idle).
4. Feature `id` for feature-state: hash Poi.id → numeric (stable helper in util; document).

## Acceptance Criteria

- [ ] e2e (stubbed geosearch): zoom 15 Tokyo → ≤1 request, 20 pins; small pan (<25% diag) → no new
      request; large pan → 1 request; zoom 12 → pins hidden + status below-zoom + hint pill once.
- [ ] e2e: toggle off mid-flight → no pins, aborted request (stub sees abort), toggle on → refetch.
- [ ] e2e: tap pin → selected styling + sheet opens (28 may be stub sheet if unmerged: assert
      store.selectedId + sheet:'poi').
- [ ] Unit: trigger-condition predicate (pure) truth table (≥10 rows).

## Validation

`tests/e2e/poi.spec.ts` + unit for the predicate; network spy asserts request budget.

## Dependencies

10, 23, 25. 24 (latestOnly). 28 consumes selection.

## Non-goals

Detail sheet content (28), clustering (rely on symbol collision; revisit post-v1), Commons (29).

## Design References

DESIGN §7.1, §7.2, §8 #8, §12.6; research/wikimedia-geodata-api.md §4.

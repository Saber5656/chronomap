# Title

Implement layer info badge and Layers sheet with dynamic attribution

## Summary

Build `LayerInfoBadge` (always-visible active-era badge) and the `LayersSheet` (bottom sheet
listing basemap + active overlay with attribution/license links), fulfilling the ADR-004
runtime-attribution requirement.

## Context

DESIGN §6.5. Legally required credits (GSI, Konjaku) must be visible per ADR-004/006; the badge
doubles as the "what am I looking at" affordance.

## Scope

- `src/ui/components/LayerInfoBadge.ts` (map-region bottom-left, above MapLibre attribution):
  compact pill: `{era from–to} · {layer title (lang)}` (or i18n `badge.presentDay` when
  activeLayerId null). Tap → `actions.openSheet('layers')`.
- `src/ui/components/LayersSheet.ts` rendered by the BottomSheet host (build the minimal
  BottomSheet host here per §8 #9 — first sheet consumer; PoiSheet (28) reuses it):
  - Host: swipe-down + X close, `history.pushState` integration per §8.3, focus trap,
    `role="dialog"` `aria-modal="true"`.
  - Content rows: (1) basemap: GSI pale + attribution link; (2) active past layer: title, era,
    provider, `attribution.text` linking `attribution.url`, license name/url; (3) POI source row
    (static: Wikipedia CC BY-SA note — present even before W3, guarded by build presence of the
    provider registry); (4) footer link to About (47; renders disabled stub until 47).
  - All external links `target="_blank" rel="noopener noreferrer"`.
- Konjaku entries additionally show `experimental` chip when flag ON.

## Detailed Requirements

1. Badge text updates within one store notification of layer change (no polling).
2. Sheet host is generic: `openSheet(kind)` renders the registered component; only one sheet at a
   time; opening another replaces (with history replaceState, not push — one back closes all).
3. Attribution strings come from registry entries verbatim — no hardcoded provider names in
   components.
4. MapLibre built-in attribution control remains (basemap credit redundancy is fine).

## Acceptance Criteria

- [ ] e2e: select 1965 Tokyo → badge `1961–1969 · 空中写真…`; tap → sheet lists both sources with
      correct hrefs; Android-back (history.back()) closes the sheet.
- [ ] e2e: no active layer → badge shows present-day label; sheet shows basemap row only (+POI row).
- [ ] Focus trap + Esc close verified (keyboard e2e).
- [ ] Attribution text equals registry `attribution.text` (assert against loaded registry).

## Validation

`tests/e2e/layers-sheet.spec.ts`; manual visual check of pill legibility over imagery.

## Dependencies

18 (active layer state), 19 (wiring), 08 (slots). Provides BottomSheet host for 28/36/47.

## Non-goals

About/privacy content (47), per-layer coverage maps, THIRD_PARTY_NOTICES (05).

## Design References

DESIGN §6.5, §8 #6/#9, §8.3; ADR-004, ADR-006.

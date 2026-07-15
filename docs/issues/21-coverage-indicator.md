# Title

Implement coverage banner and nearest-era affordances

## Summary

Build `src/ui/components/CoverageBanner.ts` per DESIGN §6.4: a non-blocking banner for
`no-coverage`, a passive "snapped" badge when the shown layer's era ≠ selected year, and an
era-chip that jumps the year.

## Context

Era layers have patchy coverage (research/gsi-tiles.md §4); honest, calm messaging is what keeps
the product trustworthy instead of looking broken.

## Scope

- Subscribe to `timeLayer.resolution` (+ `year`):
  - reason `no-coverage`: banner over map-region top: i18n `coverage.none`
    (`この年代の画像はこの場所にはありません`) + chip `coverage.nearest` (`{year}年の画像へ`)
    computed from `candidates` — nearest era across the whole registry intersecting viewport?
    No: candidates is already viewport-filtered but empty here → compute nearest era among
    ticks whose bbox intersects viewport is empty ⇒ use registry-wide nearest era whose coverage
    intersects **any** point of the viewport = none ⇒ chip hidden; when candidates non-empty but
    reason no-coverage cannot happen (by §6.1) — so: chip shown only when zooming/panning would
    help is unknowable ⇒ v1 rule: chip appears only when `candidates.length > 0` is false AND
    there exists an enabled era layer whose coverage intersects a 4× expanded viewport bbox —
    then label `coverage.nearby` (`近くに{year}年代の画像があります`) and tap flies there
    (bbox center). Implement exactly this rule; it is deliberately simple.
  - `snapped === true`: passive badge (bottom of map region, above dock): i18n `coverage.snapped`
    (`表示中: {layerTitle}（{from}–{to}年）`) — informational, auto-hides after 4 s, reappears on
    change.
  - reason `registry-empty`: banner `coverage.registryError` + disables slider via store flag
    (slider reads it; add `timeLayer.disabled` boolean to AppState — small schema addition,
    update 09 types in this PR).
- Banner is `aria-live="polite"`, non-interactive except the chip; never blocks map gestures
  (pointer-events only on chip).

## Detailed Requirements

1. State transitions must be flap-free: banner appears/disappears with 200 ms delay hysteresis
   (rapid pan across a coverage edge shouldn't strobe).
2. The expanded-bbox search is pure and unit-tested (`util/geo.ts: expandBbox(bbox, factor)`).
3. Chip flight: `flyTo` respecting reduced-motion; year set to era midpoint.

## Acceptance Criteria

- [ ] e2e: Tokyo viewport, year 1890 (GSI-only build) → banner visible; tap nearby-chip (fixture
      guarantees a nearby konjaku-less GSI era? use year 1930 viewport outside riku10 bbox with
      usa10 nearby) → camera+year change and banner clears.
- [ ] e2e: year 1972 (between old10 and gazo1) → snapped badge names the chosen layer, auto-hides.
- [ ] Hysteresis: scripted pan across coverage boundary produces ≤ 2 banner toggles.
- [ ] Unit: expandBbox, nearest-era-nearby selection, hysteresis timer (fake timers).

## Validation

`tests/e2e/coverage.spec.ts` with stub `missing` tile config (07) for realism.

## Dependencies

17 (resolution result), 19 (year/wiring), 08 (slots).

## Non-goals

Per-tile coverage precision (bbox-level only, DESIGN §17.6), slider tick styling (19 owns).

## Design References

DESIGN §6.4, §13, §8 #7.

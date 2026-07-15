# Title

Implement time slider UI with era ticks, snapping label, and keyboard support

## Summary

Build `src/ui/components/TimeSlider.ts` per DESIGN §6.3: year range slider with registry-derived
era tick marks (dimmed when unavailable at current view), live year label, 150 ms settle →
resolution → overlay update, full keyboard + ARIA support.

## Context

The slider IS the product's signature interaction (§3.2). It binds year state → resolve() (17) →
overlay (18).

## Scope

- Custom slider (not `<input type=range>` — tick layer + custom thumb needed; but keep an
  offscreen native input as the accessibility backend if simpler — implementer's choice, ARIA
  contract below is what's tested).
- Rendering: horizontal track (`footer.slider-dock` slot), range `YEAR_MIN..currentYear`;
  era ticks from `eraTicks(registry)` (17) drawn as segments spanning [from,to] mapped to track
  x-positions; segments not in `timeLayer.resolution.candidates` render at 35% opacity.
- Thumb drag (pointer events, capture), track tap = jump. During drag: year label (floating above
  thumb: `1965年` / `1965`) updates live; `actions.setYear` fires on 150 ms settle (debounce)
  and on release.
- Keyboard (focus on slider): `←/→` ±1, `Shift+←/→` ±10, `PageUp/PageDown` next/prev era start,
  `Home/End` min/max — each immediate (no debounce).
- ARIA: `role="slider"`, `aria-orientation="horizontal"`, `aria-valuemin/max/now`,
  `aria-valuetext` = i18n `slider.valuetext` `{year}年 — {layerTitle}` (or "データなし" when
  reason no-coverage); `aria-live` handled by 41's announcer — expose a `yearchange` custom event.
- Reflect external year changes (deep link, era-chip jump from 21) into thumb position.

## Detailed Requirements

1. Touch target: full dock height (≥44px); thumb ≥ 28px visual, 44px hit.
2. No layout thrash: positions computed from cached track width (recompute on `resize` only).
3. Era ticks update when registry/candidates change (subscribe to `timeLayer.resolution`).
4. The slider never calls resolve()/overlay directly — it only writes `year`; the wiring
   `year/view → resolve → setActiveLayer` lives in `src/app/timeWiring.ts` (create here):
   subscribes to `view` (moveend) + `year`, calls resolve(), writes `activeLayerId` + resolution.

## Acceptance Criteria

- [ ] e2e: drag from current year to 1965 → overlay switches to `gsi-ort-old10` (stubbed tiles;
      Tokyo viewport); URL `year=1965` after settle; label shows during drag.
- [ ] e2e keyboard: focus slider, press Home → year 1890, reason no-coverage banner state
      (21 pending: assert store reason only), End → current year → seamlessphoto.
- [ ] ARIA attributes present and updated (axe-style assertion in e2e).
- [ ] Unit: year↔x mapping math, debounce, era-jump key logic (pure helpers).

## Validation

`tests/e2e/slider.spec.ts`; unit specs for helpers.

## Dependencies

09, 17, 18. i18n keys (39 executes earlier in wave order).

## Non-goals

Coverage banner UI (21), opacity (20), tick dimming animation polish, POI interplay.

## Design References

DESIGN §6.3, §3.2, §8 #3, §11.2.

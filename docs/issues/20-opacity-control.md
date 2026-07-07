# Title

Implement past-layer opacity control

## Summary

Add `src/ui/components/OpacityControl.ts`: a compact control in the slider dock cycling/adjusting
past-layer opacity (100 / 60 / 0%) with long-press for a fine slider, persisted only in URL (`op`).

## Context

DESIGN §8 #4. Comparing past vs present is the "recognize this used to be…" moment (§1); a
lightweight peek control is v1 scope (swipe-compare is deferred, §2.3).

## Scope

- Button in `slider-dock` right edge showing current mode icon + percentage; tap cycles
  100 → 60 → 0 → 100 (`actions.setOpacity`).
- Long-press (500 ms) opens a vertical mini-slider popover (0–100, step 5) — same pattern as any
  popover: Esc/outside closes; releases write final value.
- Hidden/disabled (aria-disabled + 40% opacity) when `activeLayerId === null`.
- Value flows: store → overlay manager `setOpacity` (18 already subscribes); URL `op` param
  (11/12 already handle serialization).

## Detailed Requirements

1. Cycling must be instant (no animation) — overlay 18 sets paint property directly.
2. Icons: three distinct glyphs (opaque square / half / outline); `aria-label` i18n
   `opacity.label` with current % in `aria-valuetext` (role="button" + value in label is fine —
   keep simple: label text includes %).
3. 0% keeps the past layer mounted (tiles stay warm) — just transparent.
4. Deep link `op=60` reflects in the control on boot.

## Acceptance Criteria

- [ ] e2e: cycle taps change `getPaintProperty('raster-opacity')` 1→0.6→0→1; URL updates after
      settle; boot with `?op=60` shows 60% state.
- [ ] Long-press slider sets 25% (drag emulation) and closes properly.
- [ ] Disabled state when no active layer (Home-year no-coverage viewport).
- [ ] Unit: cycle sequence + long-press threshold helpers.

## Validation

`tests/e2e/opacity.spec.ts` extension of slider spec.

## Dependencies

18 (overlay), 19 (dock exists), 11/12 (op param).

## Non-goals

Swipe/split compare (v2), per-layer opacity memory, animation.

## Design References

DESIGN §8 #4, §5.2 (`op`), §2.3.

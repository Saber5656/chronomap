# Title

Implement app shell layout and component mounting convention

## Summary

Build the AppShell: full-viewport CSS grid hosting the map region, slider dock, corner controls,
bottom-sheet host and toast host, plus the `mount(parent, store) → { destroy() }` component
convention and the `el()` DOM helper.

## Context

DESIGN §8 fixes a component inventory with a uniform contract so later UI issues (13, 19, 20, 22,
28, 36, 40, 42) plug into known slots without layout rework.

## Scope

- `src/util/dom.ts`: `el(tag, attrs?, children?)` typed helper creating elements; sets attributes
  via `setAttribute`, text via `textContent` (NO html string API — lint enforces).
- `src/app/appShell.ts`: mounts into `#app`:
  - `.shell` grid: `header.controls-top` (right-aligned column: LocateButton slot, PoiToggle slot,
    MenuButton slot), `main.map-region` (`#map` container + CoverageBanner slot + LayerInfoBadge
    slot), `footer.slider-dock` (TimeSlider slot + OpacityControl slot), `#sheet-host`,
    `#toast-host`.
  - Slot API: `getSlot(name): HTMLElement` for the named slots above.
- `src/ui/styles/base.css`: reset (box-sizing, margin 0), CSS custom properties (design tokens:
  `--color-bg`, `--color-accent`, `--color-text`, `--radius`, `--shadow`, `--z-map/-chrome/-sheet/
  -toast`), safe-area padding via `env(safe-area-inset-*)`, `100dvh` viewport handling.
- Replace issue-01 placeholder `main.ts` body with: create store (stub until 09), mount AppShell.
- Component contract documented in `src/ui/components/README.md` (≤15 lines): signature, subtree
  ownership, `textContent`-only rule, CSS co-location `ComponentName.css`.

## Detailed Requirements

1. Layout must keep the map interactive area unobstructed: chrome elements are absolutely
   positioned overlays; slider dock height ≤ 96px; all overlays respect safe areas.
2. No horizontal page scroll at 320px width; shell renders correctly 320–1280px.
3. Z-order: map < chrome < sheet < toast (use the z tokens).
4. Dark-mode: honor `prefers-color-scheme` for chrome colors via tokens (map tiles unaffected).

## Acceptance Criteria

- [ ] `npm run dev` shows the shell with empty slots; DOM structure matches the slot list above.
- [ ] e2e boot spec (07) updated: asserts `.shell`, `#map`, `.slider-dock` present.
- [ ] No `innerHTML` anywhere (lint passes).
- [ ] Rotating a 390×844 viewport to landscape keeps controls visible and non-overlapping.

## Validation

Unit: `el()` helper (attrs, children, text). E2E: boot spec assertions. Manual: 320px/desktop/
landscape screenshots in PR.

## Dependencies

01 (scaffold). 02 (lint active).

## Non-goals

Real components (later issues), i18n wiring (39 — but hardcode zero user-visible strings here;
shell is chrome-only), map init (10).

## Design References

DESIGN §8, §8.1, §4.1; ADR-002.

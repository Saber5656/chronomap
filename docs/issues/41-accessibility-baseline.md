# Title

Accessibility baseline pass (keyboard, ARIA, contrast, reduced motion)

## Summary

Execute the DESIGN §11.2 checklist across all shipped components: keyboard operability, focus
management, ARIA labeling, contrast tokens, reduced-motion audit, and a year-change screen-reader
announcer — with automated assertions where practical.

## Context

A map app tends to be pointer-only by accident. §11.2 sets a pragmatic baseline (not full WCAG
conformance) appropriate for v1 OSS.

## Scope

- Audit + fix per component (08–42 set): tab order (controls-top → map → dock → sheet when open),
  visible `:focus-visible` ring token, Esc closes popovers/sheets, focus trap in sheets (22 host —
  verify + fix), focus return to opener on close.
- `src/ui/a11y/announcer.ts`: visually-hidden `aria-live="polite"` region; announce year changes
  throttled to settle (i18n `slider.valuetext` reuse) and layer switches (`announce.layerChanged`).
- Contrast: verify chrome tokens (08) ≥ 4.5:1 text / 3:1 UI on both light/dark; adjust token
  values; document measured ratios in PR (tooling: any contrast checker; record numbers).
- Map-over-imagery legibility: badges/banners get scrim backgrounds (token
  `--color-scrim`) — verify over bright aerial fixture.
- Reduced motion: grep all animations (crossfade 18, flyTo 13/21, sheet transitions 22, toast 40,
  onboarding 42) honor `prefers-reduced-motion` — add missing guards.
- Touch targets: assert ≥ 44px on LocateButton, PoiToggle, MenuButton, slider thumb hit area,
  sheet close, toast action (e2e bounding-box checks).
- Zoom/scale: page functional at 200% browser zoom (no clipped controls).

## Detailed Requirements

1. Every fix lands in the owning component's file; this issue may touch many files but only for
   a11y deltas (no refactors).
2. Add e2e `tests/e2e/a11y.spec.ts`: keyboard-only journey (tab to slider → change year → tab to
   locate → activate → open layers sheet → Esc) with focus assertions; touch-target size
   assertions; `aria-live` region updated on year change.
3. Lighthouse a11y ≥ 90 in 46's CI run (this issue makes it true; 46 enforces).

## Acceptance Criteria

- [ ] Keyboard-only journey e2e passes with zero pointer events.
- [ ] Announcer emits on year settle (not per drag frame) — asserted via DOM text.
- [ ] Contrast table in PR (token → ratio → pass) covering text, badges, banner, toast, buttons.
- [ ] Reduced-motion e2e (emulate media) shows instant layer swap + jumpTo.

## Validation

`tests/e2e/a11y.spec.ts`; manual VoiceOver (iOS) smoke noted in PR (best-effort, non-blocking).

## Dependencies

Components through 40 (audits them). Blocks nothing; 46 measures the result.

## Non-goals

Full WCAG 2.2 conformance claim, screen-reader map exploration (canvas map limits — out of scope),
high-contrast theme (v2).

## Design References

DESIGN §11.2, §6.3 (slider ARIA), §8.

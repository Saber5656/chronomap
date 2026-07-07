# Title

Implement first-run onboarding coach marks

## Summary

Build `src/app/onboarding.ts`: a one-time, three-step dismissible coach (slider → locate →
menu/share-import) shown on first visit, per DESIGN §3.1.

## Context

The time slider is a novel control; a 10-second nudge materially improves first-session success.
Must be skippable, tiny, and never shown again after dismissal.

## Scope

- Trigger: after first map `idle` on `/` when `localStorage["chronomap.onboarded"] !== "1"` AND
  no deep-link params present (arriving via share = user already has context; skip and mark done).
- Three sequential coach marks (anchored tooltips with scrim cutout — CSS only, no lib):
  1. slider dock: i18n `onboard.slider` (`スライダーで年代を移動`)
  2. LocateButton: `onboard.locate` (`現在地から時間旅行を始める`)
  3. MenuButton: `onboard.menu` (`リンク共有や貼り付けはこちら`)
  Controls: `onboard.next` (`次へ`) / `onboard.done` (`はじめる`) / `onboard.skip` (`スキップ`,
  step 1 only, text button).
- Any outside interaction (map gesture) = skip-all + mark done.
- Set the flag on completion OR skip; never re-show (Language toggle later does not re-trigger).
- Reduced-motion: no pulse animations; static highlight.

## Detailed Requirements

1. Coach must not block the slider/map hit-testing outside the scrim cutout — implement cutout
   via 4 scrim rects around the target (pointer-events on scrim only).
2. Focus management: coach steps are keyboard reachable (Next focused on open); Esc = skip-all.
3. Anchored positioning reuses 33's popover placement helper (flip near edges).
4. Total added JS ≤ 6 KB (lazy `import()` after idle — §14 budget).

## Acceptance Criteria

- [ ] e2e: fresh context → 3 steps navigable → flag set → reload shows nothing.
- [ ] e2e: deep-link entry (`?lat=…`) → no coach, flag set.
- [ ] e2e: map pan during step 2 → coach gone, flag set.
- [ ] Keyboard path (Enter through steps, Esc skip) verified; reduced-motion static rendering.

## Validation

`tests/e2e/onboarding.spec.ts` (fresh storage state per test).

## Dependencies

13, 19, 12 (targets exist), 33 (placement helper), 39 (strings).

## Non-goals

Feature tours beyond 3 steps, re-showable help center (About covers reference content, 47),
analytics on completion (none).

## Design References

DESIGN §3.1, §8 #13, §14.

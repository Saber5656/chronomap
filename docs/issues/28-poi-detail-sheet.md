# Title

Implement POI detail bottom sheet

## Summary

Build `src/ui/components/PoiSheet.ts` on the BottomSheet host (22): title-first render, async
summary fill (26), thumbnail, external Wikipedia link, map-app handoff button, attribution footer.

## Context

DESIGN §7.3/§3.3 — the reading surface of the product. Strict rendering rules apply (extract is
untrusted text; §12.2 A5).

## Scope

- Opens when `ui.sheet === 'poi' && poi.selectedId`; renders immediately with `Poi.title` +
  distance chip (`{n} m` / `{n.k} km`, i18n `poi.distance`), skeleton lines for extract.
- Kick `fetchPoiDetail` (26) with abort on close/selection change; fill: thumbnail `<img>`
  (`loading="lazy"`, `referrerpolicy="no-referrer"`, alt = title, fixed 96×96 object-fit cover,
  hidden on error/absent), extract via `textContent`, links:
  - `poi.readOnWikipedia` → `pageUrl` (`target="_blank" rel="noopener noreferrer"`).
  - `poi.openInMaps` → outbound module (32; until merged render disabled with tooltip i18n
    `common.comingSoon` — remove flag when 32 lands, tracked in 32).
- Error state: i18n `poi.detailError` + retry button (re-invokes fetch).
- Footer: `poi.attribution` (`Text: Wikipedia (CC BY-SA)`) linking the article.
- Sheet behavior (host from 22): half-height default, drag to full/close; selection change while
  open swaps content in place (no close/reopen flicker).
- Deselect behavior: if `poi.selectedId` is cleared while `ui.sheet === 'poi'`, the controller closes
  the sheet explicitly instead of rendering an empty open sheet.
- Peek behavior: sheet must not cover the slider dock at half height (layout: sheet max-height
  `calc(50dvh - dock)`).

## Detailed Requirements

1. Extract renders with `white-space: pre-line`, capped at 8 lines + fade (CSS only; full text
   already ≤1200 chars).
2. Thumbnail must never trigger layout shift (reserved box).
3. Abort discipline: closing the sheet mid-fetch produces no state write (test via delayed stub).
4. All strings via i18n keys listed above (add to both locales).

## Acceptance Criteria

- [ ] e2e: tap pin → sheet shows title instantly; after stub delay, extract + thumbnail appear;
      Wikipedia link href/rel/target correct.
- [ ] e2e: select another pin while open → content swaps, exactly one summary request per
      selection (spy).
- [ ] e2e: clearing selection closes the POI sheet and leaves no empty dialog visible.
- [ ] e2e error path: 500 stub → error text + retry works.
- [ ] e2e: swipe-down closes; history back closes; slider remains visible/usable at half height.

## Validation

`tests/e2e/poi-sheet.spec.ts` (extends 27's spec stubs).

## Dependencies

22 (BottomSheet host), 26 (detail provider), 27 (selection). 32 enables the handoff button.

## Non-goals

Commons strip (29 slots into this sheet), sharing a POI (v1 shares views, not POIs), year linkage.

## Design References

DESIGN §7.3, §3.3, §8 #9, §12.2 A5.

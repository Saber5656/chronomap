# Title

Implement ImportSheet paste-to-open fallback

## Summary

Build `src/ui/components/ImportSheet.ts`: a bottom sheet where users paste a map URL / coordinates
/ geo: text to open it, with reason-specific guidance for parse failures — the universal fallback
for platforms without share-target support (iOS browsers, desktop).

## Context

DESIGN §8 #10 / §9.3. This is the guaranteed-everywhere inbound path and the landing surface for
`/share` failures (35).

## Scope

- Sheet (host from 22), opened via: MenuButton item i18n `menu.import` (`場所を貼り付けて開く`),
  or programmatically by 35 with `{ prefill, reason }`.
- Content: multiline input (rows=3, `maxlength=4096`, `autocomplete=off`, `spellcheck=false`,
  placeholder i18n `import.placeholder` — `例: geo:35.68,139.76 / Google/Appleマップの共有URL /
  35.68, 139.76`), primary button `import.open` (`開く`), paste-from-clipboard button when
  `navigator.clipboard.readText` available (permission-gated, fails silently to manual paste).
- Submit → `parseSharedLocation` →
  - ok: close sheet, `setView({lat,lng,zoom: zoom ?? 16})`, marker+label if present (33 infra),
    toast `import.opened`.
  - fail: inline guidance block (not toast; persistent):
    - `shortlink`: i18n `import.err.shortlink` — explain: open the link in the maps app/browser,
      copy the full URL or the coordinates, paste here (mention Google Maps「座標をコピー」).
    - `no-coords`: `import.err.nocoords` — the text had no usable coordinates; suggest sharing
      again choosing the URL option or copying coordinates.
    - `invalid`: `import.err.invalid` — generic re-check message.
- Guidance strings live in i18n with ja primary; keep ≤ 2 sentences each.

## Detailed Requirements

1. Input value is processed in-memory only; cleared on close; never persisted/logged.
2. Enter (desktop) submits; IME-composing Enter must NOT submit (check `isComposing`).
3. The sheet is fully usable offline (parser is local).
4. Autofocus input when opened by user action; NOT when opened by 35 failure (avoid keyboard
   popping over the guidance).

## Acceptance Criteria

- [ ] e2e: paste Apple URL → map moves, sheet closes, toast; paste shortlink → shortlink guidance
      visible, input preserved for edit.
- [ ] e2e: IME composition Enter does not submit (Playwright `insertText` +
      composition events emulation; if flaky, unit-test the keydown handler predicate instead —
      document choice).
- [ ] e2e: opened from menu → focused input; opened via `/share` failure → no autofocus, prefill
      truncated display.
- [ ] Unit: submit handler branches per ParseResult (mock parser).

## Validation

`tests/e2e/import.spec.ts` (+ share-route spec covers the 35-driven path).

## Dependencies

22 (sheet host), 34 (parser), 12 (menu), 33 (marker reuse — soft; degrade to no-marker if
unmerged).

## Non-goals

Search/geocoding (v2), history of imports (never), QR scanning (v2 idea).

## Design References

DESIGN §8 #10, §9.3, §3.4; research/map-app-integration.md §2.

# Title

Implement i18n module (ja/en) with key-parity CI check

## Summary

Implement `src/ui/i18n/`: flat-key string tables for ja/en, `t()` with interpolation, locale
detection + manual toggle, and a unit-level key-parity check — **executes early in Wave 1**
(ISSUE_PLAN §2) so all UI issues use keys from day one.

## Context

DESIGN §11.1. Owner requirement: Japan-focused product, world-ready issues — bilingual UI from
the start prevents a costly retrofit.

## Scope

- `src/ui/i18n/strings.ja.json`, `strings.en.json`: flat maps; seed with the keys already named
  across issues 12/13/19/20/21/22/26–29/31/32/33/35/36/37 (grep docs/issues for backtick i18n
  keys; create the union — missing translations initially mirror ja with `TODO:` prefix in en
  where unclear, but ship real en for all seeded keys).
- `src/ui/i18n/index.ts`:
  - `initI18n(store)`: initial lang = `localStorage["chronomap.lang"]` valid value → else
    `navigator.language.startsWith('ja') ? 'ja' : 'en'`; writes `ui.lang`.
  - `t(key: I18nKey, vars?: Record<string, string|number>): string` — `{var}` interpolation;
    missing key → returns key + `console.warn` (dev only).
  - `I18nKey` = union type generated from the ja JSON via `keyof typeof` import (compile-time
    safety, no codegen).
  - `onLangChange` → components re-render (components subscribe to `ui.lang`; document the
    convention: components read strings inside render, re-run on lang change).
- Language toggle: MenuButton item `menu.lang` cycling ja ⇄ en; persists to localStorage;
  `<html lang>` attribute updated.
- Unit check `tests/unit/i18n/parity.spec.ts`: key sets of ja/en are identical; no empty values;
  interpolation vars used in ja exist in en (regex `{(\w+)}` set equality per key).

## Detailed Requirements

1. No i18n library dependency; module ≤ 120 lines.
2. Keys are dot-namespaced (`slider.valuetext`); never dynamic key construction from user input.
3. Number/date formatting: `Intl.NumberFormat`/none needed beyond distance in 28 — provide
   `formatDistance(m, lang)` here (m → `850 m` / `1.2 km`).
4. `aria-*` strings included (a11y strings are i18n keys too).

## Acceptance Criteria

- [ ] Parity spec passes; deliberately removing an en key fails it.
- [ ] e2e: toggle to en → slider valuetext/badges/menu switch; reload keeps en; `<html lang="en">`.
- [ ] tsc: `t('nonexistent.key')` fails typecheck (`@ts-expect-error` test).
- [ ] `formatDistance` unit table (999→`999 m`, 1000→`1.0 km`, 12345→`12 km`).

## Validation

`npm run test` + `tests/e2e/i18n.spec.ts`.

## Dependencies

08 (menu slot exists), 09 (ui.lang). Executes before 10–13 UI text lands (ISSUE_PLAN wave order).

## Non-goals

More locales (v2 — table structure already supports), ICU plurals (avoid needing them in copy),
translating docs/.

## Design References

DESIGN §11.1, §8 #11; ISSUE_PLAN §2 note.

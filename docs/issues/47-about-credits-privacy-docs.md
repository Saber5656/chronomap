# Title

Implement About sheet (credits + privacy) and rewrite README as user/developer docs

## Summary

Build the AboutSheet with data-source credits, licenses, and the §12.6 privacy disclosures;
rewrite README.md into the product's bilingual front page (usage, integrations, development,
licensing).

## Context

ADR-004 (attribution surface), DESIGN §12.6 (privacy disclosures are a design requirement —
location data flows must be user-visible), and the repo's public face for OSS release.

## Scope

- `src/ui/components/AboutSheet.ts` (host from 22; MenuButton item `menu.about`; LayersSheet
  footer link enables now):
  - App name + version (`__APP_VERSION__`) + link to repository.
  - Data sources section (rows generated from the layer registry's distinct providers + static
    POI row): provider name, credit text (verbatim registry `attribution.text`), license link —
    GSI row, Konjaku row (only when flag ON), Wikipedia/Wikimedia row.
  - Privacy section (i18n keys `about.privacy.*`, content per §12.6 (a)–(e); ~10 short lines,
    ja/en).
  - Links: LICENSE, THIRD_PARTY_NOTICES.md (repo URLs), SECURITY.md, ios-shortcut doc.
  - `menu.registerGeo` item relocation check (37 placed it — keep in menu, not About; verify).
- README.md rewrite (keep the first line + one-liner, then bilingual sections ja first):
  What it is (1 para + screenshot placeholder), Try it (deployed URL), Features, Opening from
  other map apps (38's matrix — merge/own that section), Privacy summary (3 bullets + link to
  in-app note), Development (prereqs, `npm ci`, scripts table, docs/ map: DESIGN → ISSUE_PLAN →
  issues), Data sources & licenses table, Contributing/Security links, License footer.
- `docs/README.md` (5 lines): corpus map for contributors (what lives where, issue workflow rule
  from ISSUE_PLAN §7).

## Detailed Requirements

1. Privacy text must match actual behavior (cross-check against 13/25/31 implementations —
   listing localStorage keys exactly: `chronomap.lang`, `chronomap.onboarded`).
2. About content lazy-loaded (dynamic import — §14).
3. No marketing fluff; factual, short, bilingual parity (i18n parity spec covers keys).
4. Screenshot placeholder only (real capture at 48).

## Acceptance Criteria

- [ ] e2e: menu → About → sections render; provider rows match loaded registry; privacy list
      shows the two localStorage keys; all links have correct hrefs + noopener.
- [ ] README renders correctly on GitHub (manual check), bilingual, all links resolve.
- [ ] i18n parity spec passes with new keys; Konjaku row hidden with flag OFF.
- [ ] Registry-driven credits: adding a fixture provider in a test shows a new row (unit or e2e).

## Validation

`tests/e2e/about.spec.ts` + README link check (`npx markdown-link-check` locally or manual —
document).

## Dependencies

22 (sheet host), 39 (i18n), 05 (legal files), registries (15/16), 38 (integration doc to link).

## Non-goals

Blog/marketing site, in-app changelog, help center, analytics.

## Design References

DESIGN §12.6, §8 #9, §2; ADR-004, ADR-005.

# Title

Add MIT LICENSE, THIRD_PARTY_NOTICES skeleton, and licensing README section

## Summary

Add the code license (MIT, owner-confirmed) and the scaffolding that keeps code license and data
attribution obligations visibly separate.

## Context

ADR-004: code is MIT; tile/API data impose independent attribution duties that survive forks.
This issue creates the legal files; runtime attribution UI is issue 22/47.

## Scope

- `LICENSE`: standard MIT text, `Copyright (c) 2026 Saber5656`.
- `THIRD_PARTY_NOTICES.md`: header explaining purpose + placeholder sections: "Bundled npm
  packages" (filled at release, issue 48) and "Data sources & required attributions" table
  pre-filled from ADR-004 (GSI / Konjaku Map / Wikipedia CC BY-SA rows with their required credit
  text and URLs from `docs/research/`).
- README: append a "License & data attribution" section (bilingual ja/en, ~10 lines): code MIT;
  map data & article content have their own terms; forks must retain provider attributions;
  link to THIRD_PARTY_NOTICES.md.

## Detailed Requirements

1. Do not modify the existing README first line / product description.
2. The data-attribution table must quote the exact on-screen credit strings:
   「地理院タイル（国土地理院）」 and 「今昔マップ on the web」 (with ADR-006 gate note),
   "Wikipedia text: CC BY-SA".

## Acceptance Criteria

- [ ] `LICENSE` detected by GitHub as MIT (repo About sidebar shows MIT after merge).
- [ ] THIRD_PARTY_NOTICES.md contains the three data-source rows with credit strings + source URLs.
- [ ] README section present in ja and en.

## Validation

Visual review; `gh repo view --json licenseInfo` shows MIT after merge to main.

## Dependencies

None (can run parallel to 01).

## Non-goals

Runtime attribution UI (22), About/privacy screen (47), npm notice generation (48).

## Design References

ADR-004, ADR-006; research/gsi-tiles.md §3; research/konjaku-map-tiles.md §3.

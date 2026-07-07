# ADR-004: MIT license for code; layered attribution policy for data

Date: 2026-07-07 / Status: Accepted (license choice confirmed by owner 2026-07-07)

## Context

The repository will be released publicly as OSS. Code license and *data* attribution are separate
obligations: tile/API providers each impose their own credit requirements regardless of code license.

## Decision

- Code: **MIT** (`LICENSE` at repo root, issue 05). Copyright holder: repository owner.
- Data attribution is a **runtime feature, not a docs footnote**: the map always shows the
  attribution line(s) of every currently visible source (issue 22), and an About/credits screen
  lists all sources with their terms (issue 47):
  - GSI: 「地理院タイル」 credit + link (research/gsi-tiles.md §3)
  - Konjaku Map: on-screen 「今昔マップ on the web」 + release permission gate (ADR-006)
  - Wikipedia/Wikimedia: article links + CC BY-SA notice for extracts
- `THIRD_PARTY_NOTICES.md` tracks bundled npm license notices at release (issue 48).

## Consequences

- MIT imposes no copyleft on downstream forks; data obligations still bind them — the About screen
  text explicitly says forks must keep provider attributions.
- Attribution UI becomes an acceptance criterion in every dataset issue (15, 16, 25, 29); an
  implementation agent cannot ship a provider without its credit line.

# Title

Implement Wikipedia page-summary provider (PoiDetail)

## Summary

Implement `src/providers/poi/wikipediaSummary.ts`: fetch REST v1 `page/summary` for a selected
POI and map it to a guarded `PoiDetail` (plain-text extract, allowlisted thumbnail).

## Context

DESIGN §7.3: the detail sheet needs summary + thumbnail. §12.2 A5: extract/thumbnail are untrusted;
only the plain `extract` field is ever used (never `extract_html`).

## Scope

- `fetchPoiDetail(poi: Poi, opts { signal }): Promise<PoiDetail>`:
  - Derive title-less endpoint: REST summary requires a title — geosearch gave `title`; store it:
    **amend `Poi` (23) with `title` already present — use it**; URL:
    `https://{lang}.wikipedia.org/api/rest_v1/page/summary/{encodeURIComponent(title.replaceAll(' ','_'))}`.
  - Map: `extract` (plain string field ONLY) → validator `extract()` (≤1200, control-stripped,
    ellipsis on truncation); `thumbnail.source` → `httpsUrl(…, ['upload.wikimedia.org'])`,
    absent OK; `content_urls.desktop.page` → `httpsUrl(…, ['{lang}.wikipedia.org'])`, fallback
    `poi.source.url`; `attributionKey: 'wikipedia-ccbysa'`.
  - Cache via 24's LRU: key `summary:{lang}:{title}`.
  - Verify-at-impl (DESIGN §17.7): confirm thumbnail default size (~320px) adequate for the
    sheet; if a sizing param/thumbor pattern is available, record it in code comment — do NOT
    URL-rewrite thumbnails (keeps allowlist strict).
- Fixtures: summary happy (with/without thumbnail), disambiguation page (`type:
  'disambiguation'` → still render extract), 404 (deleted page → `http` error mapped to sheet
  error state), malicious fixture (script tags inside extract string — passes through as inert
  text; length attack 100 KB extract → truncated).

## Detailed Requirements

1. Never request `action=parse` or any HTML endpoint.
2. `extract` may legally contain `<` `>` characters as text — renderer (28) uses `textContent`;
   this provider must NOT html-escape (double-escaping bug).
3. Underscore/space title normalization per MediaWiki convention (test both).

## Acceptance Criteria

- [ ] Unit: URL encoding cases (spaces, Japanese, slashes in titles like `AC/DC`), mapping,
      truncation at exactly 1200 + ellipsis, thumbnail allowlist rejection (host
      `evil.example` dropped, detail still returned), 404 path, cache hit.
- [ ] Fixture with `extract_html` present: field ignored (assert output equals plain extract).
- [ ] Coverage ≥ 95% for the module.

## Validation

`npm run test`.

## Dependencies

23, 24, 25 (Poi carries lang/title).

## Non-goals

Sheet UI (28), Commons images (29), multi-paragraph article fetch (never in v1).

## Design References

DESIGN §7.3, §5.4, §12.2 A5, §17.7; research/wikimedia-geodata-api.md §2.

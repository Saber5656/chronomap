# Title

Define POI provider interface, models, and provider registry

## Summary

Implement `src/providers/poi/types.ts` (Poi, PoiDetail, PoiProvider per DESIGN §5.4), the provider
registry with locale-based selection, and response validation guards — the world-ready seam for
POI sources (ADR-003).

## Context

The POI subsystem must be pluggable (Wikipedia now; Wikidata/other sources later) and every
provider response must pass boundary validation (§12.3, abuse case A5).

## Scope

- `types.ts`: the DESIGN §5.4 interfaces verbatim (Poi, PoiDetail, PoiProvider) plus
  `PoiProviderError = { kind: 'network'|'timeout'|'http'|'malformed'|'aborted'; status?: number }`
  (typed error union returned via rejected promise with this shape).
- `src/providers/poi/registry.ts`: `getPoiProvider(locale: 'ja'|'en'): PoiProvider` — v1 returns
  the Wikipedia provider bound to `ja.wikipedia.org` / `en.wikipedia.org` (25). Flag-gated Commons
  provider lookup `getPhotoProvider()` (29) returns null when `VITE_ENABLE_COMMONS_PHOTOS` unset.
- `src/providers/poi/guards.ts`: `assertPoi(raw: unknown): Poi | null` and
  `assertPoiDetail(raw): PoiDetail | null` — structural guards applying validators
  (`poiTitle`, `latLng`, `extract`, `httpsUrl` with host allowlists: page URLs
  `{lang}.wikipedia.org`, thumbnails `upload.wikimedia.org`); item-wise rejection.
- Extend AppState only if needed — §5.1 already models poi slice; no changes expected.

## Detailed Requirements

1. Interfaces must not leak Wikipedia specifics (no `pageid` field on Poi; provider embeds it in
   `id` as `wikipedia-{lang}:{pageid}`).
2. Guards never throw; malformed items are dropped and counted (return `{items, dropped}` from a
   list-level `guardPois(raw[])`).
3. All code pure/DOM-free (unit-testable in Node).

## Acceptance Criteria

- [ ] Unit: guards accept valid fixtures; reject items with: non-finite coords, title > 300 chars
      (truncation NOT allowed for title — reject), http:// page URL, thumbnail on foreign host,
      missing fields. ≥ 12 cases from `tests/unit/fixtures/poi/`.
- [ ] Registry returns ja/en-bound providers; Commons lookup null without flag.
- [ ] tsc strict clean; no `any`.

## Validation

`npm run test`.

## Dependencies

09 (state types), 11 (validators). Blocks 24–29.

## Non-goals

HTTP code (24), rendering (27), Wikidata/date filtering (v2).

## Design References

DESIGN §5.4, §12.2 A5, §12.3; ADR-003.

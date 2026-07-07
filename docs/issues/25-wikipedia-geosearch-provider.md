# Title

Implement Wikipedia GeoSearch POI provider

## Summary

Implement `src/providers/poi/wikipediaGeosearch.ts`: the `PoiProvider` that queries
`list=geosearch` and maps results through the guards into `Poi[]`.

## Context

research/wikimedia-geodata-api.md §1 documents the API; this provider is the v1 source of pins
(DESIGN §7.1). It must be a pure mapper over the client core (24).

## Scope

- `createWikipediaProvider(lang: 'ja'|'en'): PoiProvider` with `minZoom = POI_MIN_ZOOM`:
  - URL: `https://{lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord={lat}|{lng}
    &gsradius={radiusM}&gslimit=50&gsnamespace=0&format=json&origin=*`
    (URLSearchParams-built; lat/lng fixed to 6 dp; radius int clamped 100–10000).
  - Cache key: `wikipedia:{lang}:{lat3dp}:{lng3dp}:{radiusBucket}` where radiusBucket =
    `Math.round(radiusM/500)*500` (per §7.1 cache rule).
  - Map `query.geosearch[]` → `Poi` via `guardPois`: id `wikipedia-{lang}:{pageid}`,
    `source.url = https://{lang}.wikipedia.org/?curid={pageid}` (stable, avoids title encoding),
    `distanceM = dist`.
  - Response envelope tolerance: missing `query.geosearch` → empty list (NOT an error — the API
    returns `batchcomplete` with no results).
- Fixtures: real-shaped canned responses (Tokyo Station area, ja) committed under
  `tests/unit/fixtures/poi/geosearch-*.json` incl. a malformed variant.

## Detailed Requirements

1. No sorting beyond API order (distance-ordered by API) — slice to `POI_MAX` after guards.
2. `origin=*` mandatory (anonymous CORS; research doc).
3. Coordinates SENT are the map center passed by the caller — the provider never touches
   geolocation state (privacy boundary §12.6/ADR-005).
4. API `error` field in 200 responses → `malformed` PoiProviderError.

## Acceptance Criteria

- [ ] Unit: URL construction exact-match snapshot for a known input (params order stable);
      happy path maps fixture → 20 Pois with correct ids/urls; empty result path; API-error path;
      malformed items dropped (count asserted); >50 items sliced.
- [ ] Cache: identical rounded inputs → 1 fetchImpl call (spy).
- [ ] Integration-lite: registry (23) returns this provider for both langs.

## Validation

`npm run test`; e2e coverage arrives with 27.

## Dependencies

23 (interface/guards), 24 (client core).

## Non-goals

Trigger policy/rendering (27), summaries (26), category filtering (v2).

## Design References

DESIGN §7.1, §5.4; research/wikimedia-geodata-api.md §1, §4.

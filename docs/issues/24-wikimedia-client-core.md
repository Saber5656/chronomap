# Title

Implement Wikimedia HTTP client core (politeness, caching, abort, errors)

## Summary

Implement `src/providers/poi/wikimediaClient.ts`: the single fetch wrapper for all Wikimedia
requests — Api-User-Agent header, 8 s timeout, AbortController chaining, LRU cache, single-flight
policy, and the typed error taxonomy.

## Context

research/wikimedia-geodata-api.md §4 sets the politeness contract; §12.2 A5 sets the trust
boundary (responses are untrusted). Providers 25/26/29 are thin mappers over this core.

## Scope

- `wikimediaFetch(url: URL, opts: { signal?: AbortSignal }): Promise<unknown>`:
  - Asserts `url.protocol === 'https:'` and `url.host` ∈
    `['ja.wikipedia.org','en.wikipedia.org','commons.wikimedia.org']` (throws `Error` at call
    site — programmer error, not input error).
  - Headers: `{ 'Api-User-Agent': 'chronomap/{__APP_VERSION__} (+https://github.com/Saber5656/chronomap)' }`
    (define `__APP_VERSION__` via Vite `define` from package.json — add to vite config).
  - `AbortSignal.any([opts.signal, AbortSignal.timeout(8000)])`; response must be `ok` and
    `content-type` include `application/json`; size guard: reject bodies > 512 KB
    (read via `response.text()` length check before `JSON.parse`).
  - Errors normalized to `PoiProviderError` kinds (23).
- `src/util/lru.ts`: `createLru<K,V>(capacity)` (Map-based, get-refreshes) — unit-tested.
- `cachedFetch(key: string, url, opts)` layered on the LRU (capacity 200, session lifetime).
- Single-flight helper `latestOnly()`: returns a wrapper that aborts the previous in-flight call
  when a new one starts (used by the POI controller in 27).

## Detailed Requirements

1. No retries (manual retry only, §13); no exponential backoff logic.
2. `JSON.parse` result returned as `unknown` — mapping/validation happens in providers (23 guards).
3. jsdom-unit-testable: inject `fetchImpl` for tests (default `globalThis.fetch`).
4. The host allowlist here must stay in sync with CSP `connect-src` (43) — add a shared constant
   `src/security/hosts.ts` exporting `WIKIMEDIA_API_HOSTS`, `WIKIMEDIA_IMG_HOSTS`,
   `TILE_HOSTS` (import in 14's validator too if trivially possible; else note).

## Acceptance Criteria

- [ ] Unit (mock fetchImpl): success JSON path; non-JSON content-type → `malformed`; HTTP 500 →
      `http` with status; timeout (fake timers) → `timeout`; abort → `aborted`; oversized body →
      `malformed`; disallowed host throws synchronously; UA header present on every call.
- [ ] LRU: eviction order, refresh-on-get, capacity 1 edge. 100% coverage on lru.ts.
- [ ] `latestOnly`: second call aborts first (spy on abort).

## Validation

`npm run test` (`tests/unit/providers/wikimediaClient.spec.ts`).

## Dependencies

23 (error type), 11 (validators exist), 03.

## Non-goals

Endpoint construction (25/26/29), UI states (40), request scheduling policy (27 owns triggers).

## Design References

DESIGN §7.1, §12.2 A5, §12.3, §13; research/wikimedia-geodata-api.md §4.

# Title

Implement shared-location parser (pure, no-I/O)

## Summary

Implement `src/integrations/parseSharedLocation.ts`: the table-driven recognizer turning shared
text/URLs (geo:, plain coords, Apple Maps, Google Maps variants) into validated coordinates —
never performing network requests.

## Context

DESIGN §9.2 and research/map-app-integration.md §2. This is the security-critical funnel for all
inbound integrations (35/36/37/38); abuse cases A3/A4 land here.

## Scope

- Public API:
  ```ts
  type ParseResult =
    | { ok: true; lat: number; lng: number; zoom?: number; label?: string; source: RecognizerId }
    | { ok: false; reason: 'shortlink' | 'no-coords' | 'invalid' };
  parseSharedLocation(raw: string): ParseResult;
  ```
- Pipeline: length gate (≤4096 else `invalid`) → trim/NFC → extract first URL-ish token AND keep
  full text → recognizers in fixed order (first match wins):
  1. `geo:` URI: `geo:lat,lng[,alt][?z=zoom]` (RFC 5870 subset; reject other params silently).
  2. Apple: host `maps.apple.com` → `ll` param (lat,lng); optional `q` → label via `label()`
     validator; `address`-only → `no-coords`.
  3. Google full: hosts `www.google.com|google.com|maps.google.com|www.google.co.jp|maps.google.co.jp` path
     contains `/maps` → try in order: `query` param → `q` param → path segment `@lat,lng[,Nz]`
     (zoom from `Nz` when int 2–21).
  4. Shortlink hosts `maps.app.goo.gl|goo.gl|g.co` → `{ ok:false, reason:'shortlink' }`.
  5. Plain pair: `/(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/` on the full text with word
     boundaries; both in range after validation.
  6. Fallback `no-coords`.
- All coords through `latLng` validator; zoom through `zoom` validator (drop if invalid, not fail).
- URL parsing via `new URL()` inside try/catch; scheme allowlist `https:`/`geo:` — any other
  scheme (`javascript:`, `data:`, `http:`) skips URL recognizers (may still match plain-pair on
  the visible text; that is safe — numbers only).

## Detailed Requirements

1. Zero I/O, zero DOM: Node-pure module; no async.
2. Case-insensitive host matching; ignore port/userinfo (reject URLs with embedded credentials →
   treat as `invalid` for the URL recognizer).
3. Label: only from Apple `q` in v1 (Google labels unreliable); capped/stripped by validator.
   Map URL recognizers run before the generic plain-pair fallback so Apple labels are not lost.
4. Order-stability documented in code (adding recognizers = append or explicit re-spec).

## Acceptance Criteria

- [ ] Table-driven suite ≥ 30 cases: every recognizer happy path; Google `@` with/without zoom;
      `q=place+name` (no coords → falls through to `no-coords`); `maps.google.co.jp`; shortlinks;
      `javascript:` URI; Apple `ll` + `q` where the generic coordinate pair must not preempt the
      Apple label;
      credentials-in-URL; 10KB input; bidi/control chars in label; `geo:` with altitude; negative
      coords; comma+space pair inside a sentence; lat 91 rejection.
- [ ] Fuzz loop (seeded, 500 iters): never throws; `ok:true` outputs always in range.
- [ ] 100% branch coverage for the module.

## Validation

`npm run test`; reviewer cross-checks the case table against research/map-app-integration.md §2.

## Dependencies

11 (validators). Blocks 35/36/37/38.

## Non-goals

Fetching/expanding shortlinks (never — ADR-005), DMS formats (v2), Plus Codes (v2).

## Design References

DESIGN §9.2, §12.2 A3/A4; research/map-app-integration.md §2; ADR-005 rule 2.

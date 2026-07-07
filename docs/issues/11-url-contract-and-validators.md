# Title

Implement boundary validators and URL contract v1 parser/serializer

## Summary

Implement `src/security/validate.ts` (the single input-validation module) and
`src/state/urlState.ts` (parse/serialize of the §5.2 public URL contract), with exhaustive unit
and fuzz tests. Pure functions only.

## Context

DESIGN §5.2 defines the public deep-link API; §12.3 requires every external value to pass one
validator module. The parser is attack surface A1/A2 (§12.2) — correctness here is a security
property.

## Scope

- `src/security/validate.ts` exporting exactly (signatures per DESIGN §12.3):
  `latLng`, `zoom`, `year(y, now)`, `opacity`, `label`, `poiTitle`, `extract`,
  `httpsUrl(s, allowedHosts)`, plus low-level `finiteInRange(v, min, max)` and
  `intInRange`. Each returns a validated value or `null` (never throws on bad input).
  `label`: NFC normalize → strip C0/C1 controls + bidi controls (U+202A–202E, U+2066–2069) →
  trim → cap 120 chars.
- `src/state/urlState.ts`:
  - `parseUrlState(search: string, now: Date, registryIds: ReadonlySet<string>): Partial<AppState-shaped patch>`
    per §5.2 table: per-param validation with per-param fallback (never whole-URL rejection);
    `l` accepted only if in `registryIds`; unknown params ignored; duplicate params → first wins.
  - `serializeUrlState(state, registryIds): string` — omits default-valued params; stable param
    order `lat,lng,z,year,l,op,poi,label`; values rounded per contract.
  - Round-trip law: `parse(serialize(s))` ≡ effective values of `s`.
- Wire into boot (§4.2 step 2) — read-only here; writing is issue 12.

## Detailed Requirements

1. Numeric parsing: `Number()` on trimmed string; reject `NaN`, `±Infinity`, scientific notation
   beyond range, values like `--5`, `0x10`; clamp AFTER validity (invalid → default, out-of-range
   finite → clamp; document each choice in code comments per param, matching §5.2).
2. `search` input length cap 2048 chars — beyond: return `{}` (all defaults).
3. Fuzz tests: property-based loop (seeded PRNG, 500 iterations) generating hostile param strings
   (`1e309`, `NaN`, `<script>`, `%00`, bidi chars, 10KB strings) — parser must never throw and
   outputs always satisfy range invariants (assert with the validators themselves).
4. No DOM access, no I/O — Node-pure (fast tests).

## Acceptance Criteria

- [ ] ≥ 30 table-driven cases covering every param × {missing, valid, out-of-range, garbage,
      duplicate} + round-trip property test + fuzz loop; coverage ≥ 95% for both files.
- [ ] `label("‮abc<script>")` → controls stripped, tag chars PRESERVED as text (escaping is
      the renderer's job; validator only strips controls + caps).
- [ ] Serializer omits defaults (empty string for initial state).

## Validation

`npm run test`; reviewer spot-checks the case table against DESIGN §5.2.

## Dependencies

03 (vitest), 09 (AppState types; store actions consume these validators).

## Non-goals

history.replaceState wiring (12), `/share` route parsing (34/35 — different, stricter surface).

## Design References

DESIGN §5.2, §12.2 A1–A2, §12.3; ADR-005.

# Title

Implement deterministic layer resolution engine resolve()

## Summary

Implement `src/providers/layers/resolve.ts` — the pure function selecting the active past layer
from (year, viewport bbox, registry, optional URL override) per the DESIGN §6.1 algorithm — with
an exhaustive fixture-based unit suite.

## Context

This is the core "time travel" decision logic. It must be deterministic and fully specified so UI
issues (19/21) and future providers depend on behavior, not implementation.

## Scope

- `resolve(input: { year: number; viewBbox: Bbox; registry: LayerEntry[]; overrideId?: string })
  → { activeLayerId: string | null; reason: 'ok'|'no-coverage'|'registry-empty';
      candidates: string[]; snapped: boolean }`
  implementing §6.1 steps 0–6 exactly:
  - step 0 override honored only if enabled + coverage intersects;
  - candidates = raster-era entries intersecting bbox (use `util/geo.ts` bbox intersection —
    add `bboxIntersects(a, b)` there);
  - score = 0 if year ∈ era else min distance to era endpoints (rolling `to:null` → currentYear);
  - tie-break: smaller era span → higher priority → id ascending;
  - `snapped = score > 0`;
  - present-day preference: year ≥ currentYear−2 and `gsi-seamlessphoto` ∈ candidates → pick it.
- `candidates` returned sorted by (score asc, tie-break order) — slider tick dimming (19/21)
  consumes this.
- Export `eraTicks(registry): { layerId, from, to }[]` (enabled entries, sorted by `from`) for the
  slider.

## Detailed Requirements

1. Pure & total: never throws; empty registry → `registry-empty`.
2. Performance: O(n log n) worst case; n ≤ 200 expected — no spatial index needed (comment this).
3. Antimeridian: explicitly unsupported (Japan data); assert bboxes are minLng<maxLng in loader
   (14) so resolve can assume it — cross-check that 14 does this; if not, add here.
4. Time source: `currentYear` passed in as parameter (`now: Date`) — no `Date.now()` inside
   (testability).

## Acceptance Criteria

- [ ] Fixture suite (uses real ids from 15 + synthetic entries) covering: year inside one era;
      year between two eras (nearest wins); exact tie (span tie-break); tie again (priority);
      override valid/invalid/out-of-coverage; viewport outside all coverage; empty registry;
      rolling era; present-day preference; flag-filtered konjaku absent. ≥ 20 cases.
- [ ] Property test: for random year/bbox within Japan, result is stable across 2 calls and
      `activeLayerId ∈ candidates ∪ {null}`.
- [ ] 100% branch coverage on resolve.ts.

## Validation

`npm run test`; reviewer checks each §6.1 step has a named test.

## Dependencies

14 (types/loader), 15 (real ids for fixtures).

## Non-goals

Map mutation (18), slider (19), vector-dated resolution (v2 — return no candidates for that type).

## Design References

DESIGN §6.1, §5.3; ADR-003, ADR-006.

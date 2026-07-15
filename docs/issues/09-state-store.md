# Title

Implement typed observable store and AppState model

## Summary

Implement `src/state/appState.ts` (the full AppState interface + constants + initial state
factory) and `src/state/store.ts` (a ~60-line dependency-free observable store), fully unit-tested.

## Context

DESIGN §5.1 defines AppState verbatim; §4.3 makes the store the single source of truth. Every
subsystem subscribes to it; getting this right unblocks most of W1–W3.

## Scope

- `src/state/appState.ts`: the exact `AppState` interface from DESIGN §5.1; constants
  `YEAR_MIN=1890`, `POI_MIN_ZOOM=13`, `POI_MAX=50`, `ZOOM_MIN=2`, `ZOOM_MAX=18`;
  `createInitialState(now: Date): AppState` (defaults: view 36.5/138.5/z5, year=currentYear,
  opacity 1, poi.enabled=true, sheet 'none', lang resolved later by 39 — default 'ja').
- `src/state/store.ts`:
  ```ts
  type ShallowPatch<S> = Partial<{ [K in keyof S]: S[K] }>;
  createStore<S>(initial: S): {
    get(): Readonly<S>;                        // returns current state (readonly typed)
    set(patch: ShallowPatch<S> | ((s: Readonly<S>) => S)): void; // shallow top-level merge
    on<T>(selector: (s: S) => T, cb: (next: T, prev: T) => void): () => void; // dedup via Object.is
  }
  ```
  Notifications are synchronous, run after the state swap completes, in subscription order;
  re-entrant `set` inside a callback is queued (microtask) not recursive. Unsubscribe function
  returned by `on`.
- Actions module `src/state/actions.ts`: named mutators used by UI/map code —
  `setView`, `setYear`, `setOpacity`, `setActiveLayer`, `setPoiStatus`, `setPoiItems`,
  `selectPoi`, `setGeoStatus`, `setFix`, `openSheet`, `closeSheet`, `showToast`, `setLang`.
  Each validates via `security/validate.ts` primitives where numeric (clamping — stub import
  until issue 11 lands; define the function signatures now).

## Detailed Requirements

1. No external deps; no Proxy magic — plain object swap + selector memo.
2. `set` must not notify when selected values are `Object.is`-equal (test this).
3. Store is generic (reusable in tests with tiny states).
4. All action functions typed, no `any`.

## Acceptance Criteria

- [ ] Unit tests: get/set/merge semantics, selector dedup, unsubscribe, queued re-entrancy,
      notification order — ≥ 12 test cases, coverage 100% for store.ts.
- [ ] `createInitialState` matches DESIGN §5.1 defaults exactly (asserted in a test).
- [ ] tsc strict passes with `exactOptionalPropertyTypes`.

## Validation

`npm run test` (new specs under `tests/unit/state/`).

## Dependencies

03 (vitest). Coordinates with 11 (validators) via declared signatures.

## Non-goals

URL parsing (11/12), persistence (none in v1), any UI.

## Design References

DESIGN §5.1, §4.3; ADR-002.

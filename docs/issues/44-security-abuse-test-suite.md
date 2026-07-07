# Title

Build the security abuse-case regression suite (A1–A10 coverage)

## Summary

Encode DESIGN §12.2's abuse cases as a permanent executable suite: unit fuzz packs + e2e attack
scenarios, plus a coverage map proving each A-case has a named test.

## Context

Individual issues implemented defenses locally (11, 24, 26, 32, 34, 43). This issue makes the
threat model *regression-proof*: any future change that weakens a defense turns CI red.

## Scope

- `tests/security/` (new root, wired into vitest + playwright configs):
  - `abuse-map.md`: table A1–A10 → test file + name (the contract for reviewers).
  - Unit packs:
    - A1/A2: hostile URL-param corpus (extend 11's fuzz with a committed corpus file of ~100
      nasty strings: script tags, event handlers, bidi, nulls, huge numbers, `__proto__`,
      `constructor`, encoded variants) → parse → invariants hold; `label` output contains no
      control/bidi chars.
    - A3: parser corpus (34) extended with `javascript:`, `data:`, credential URLs, 4096+1 chars,
      nested encodings.
    - A5: malformed Wikimedia fixtures (huge extract, wrong types, `extract_html` payloads with
      scripts, thumbnail on evil host, 1000-item geosearch) → guards drop/truncate; nothing
      unvalidated reaches a `Poi`/`PoiDetail` (assert via guard return audit).
    - A6: outbound builders reject out-of-range; branded-type `@ts-expect-error` compile tests.
    - A7: registry fixture with `https://evil.example` host → build validator exit 1 (spawn the
      script in a unit test via node child_process against a temp file).
  - E2E scenarios (`tests/security/e2e/`):
    - A1: navigate `/?label=<img src=x onerror=alert(1)>&lat=35&lng=139` → label rendered as
      literal text (assert textContent + no dialog + no violation beyond none).
    - A3/A4: `/share?text=javascript:alert(1)` → ImportSheet invalid guidance; network log shows
      zero requests to non-allowlisted hosts during the whole scenario (07's recorder).
    - A8: click Wikipedia link stub → intercepted request has no `Referer` (Playwright request
      header assertion on the stubbed route).
    - A10: covered by 31's SW tests — reference, don't duplicate.
- CI: these run inside existing `test`/`e2e` steps (no new job); add `npm run test:security`
  alias running both filtered sets for local use.

## Detailed Requirements

1. Every A1–A10 row maps to ≥1 named test or an explicit pointer to the owning issue's test
   (A9 → 45's config checks, A10 → 31) — no row left "by design" without a check.
2. Corpus files are data (`.txt`/`.json`), documented per line where non-obvious.
3. Suite runtime budget: ≤ 60 s unit portion, ≤ 90 s e2e portion.

## Acceptance Criteria

- [ ] `abuse-map.md` complete; reviewer can run each named test individually.
- [ ] Deliberately weakening a defense (e.g., removing label control-strip) fails a named test —
      demonstrate one such mutation in the PR description (not committed).
- [ ] Full suite green in CI.

## Validation

CI + the documented mutation demonstration.

## Dependencies

11, 26, 32, 34, 43 (defenses exist), 07 (e2e infra).

## Non-goals

External pentest, dependency scanning (45), DoS/load testing (client app).

## Design References

DESIGN §12.2, §12.3, §15; ADR-005.

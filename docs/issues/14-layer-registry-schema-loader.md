# Title

Define time-layer registry JSON Schema, loader, and build-time validator

## Summary

Create the provider-agnostic layer registry: `registry.schema.json` (DESIGN §5.3), the runtime
loader with fail-closed validation, the committed tile-host allowlist, and the
`npm run validate:registry` build gate.

## Context

ADR-003 makes registries the extension seam for world support; §12.2 A7 makes the validator a
security control (a registry PR cannot introduce an unlisted egress host).

## Scope

- `src/providers/layers/registry.schema.json`: JSON Schema draft 2020-12 encoding DESIGN §5.3
  exactly: required fields, `id` pattern `^[a-z0-9-]{1,64}$` + uniqueness, `type` enum
  `["raster-era","vector-dated"]` (v1 loader accepts entries but only `raster-era` is renderable),
  `era.from ≤ era.to` (via `x-` note; enforced in code), coverage = array of 4-number bboxes with
  range checks, `tiles.scheme` enum, zoom ints 0–22, `title` requires `ja` and `en`,
  `attribution.text` non-empty, `flags.requiresFeatureFlag` string|null, `priority` int.
- `src/providers/layers/types.ts`: TS types mirroring the schema (hand-written, no codegen).
- `src/providers/layers/loader.ts`: `loadRegistry(json: unknown[], env): LayerEntry[]` —
  structural validation (hand-rolled guards, no runtime schema lib — keep deps minimal), era/bbox
  semantic checks, drop-invalid-with-`console.warn`, filter entries whose
  `flags.requiresFeatureFlag` is set but not truthy in `import.meta.env`, compute rolling eras
  (`era.to === null` → currentYear, used by seamlessphoto).
  NOTE: schema allows `era.to: null` for rolling layers — reflect in schema + types.
- `scripts/validate-registry.mjs` (Node, no deps): validates all `src/providers/layers/*.layers.json`
  against the schema (implement the same checks; structural duplication accepted and noted) AND
  asserts every `tiles.urlTemplate` host ∈ `src/providers/layers/allowed-hosts.json`
  (`["cyberjapandata.gsi.go.jp","ktgis.net"]`). Wire `"validate:registry"` script (CI picks it up
  via issue 04's `--if-present`).
- Empty dataset placeholder `gsi.layers.json: []` (filled by 15) so the pipeline runs.

## Detailed Requirements

1. Loader must be pure & synchronous (registry JSON is bundled via `import`).
2. Unknown extra fields: rejected by the build validator (`additionalProperties: false`),
   tolerated+stripped by the runtime loader (forward-compat).
3. Validator exit non-zero with a per-entry error report (file, index, field, reason).
4. `resolve.ts` is issue 17 — do not implement here.

## Acceptance Criteria

- [ ] Unit tests: valid fixture passes; each violation class (bad id, era inverted, 5-number bbox,
      unknown host, missing ja title, bad scheme) is rejected by BOTH loader (drop) and script
      (exit 1) — table-driven fixtures under `tests/unit/fixtures/registry/`.
- [ ] `npm run validate:registry` green in CI on the placeholder dataset.
- [ ] Adding a fixture entry with host `evil.example` fails the script with a message naming the host.

## Validation

Unit suite + CI run; reviewer diffs schema against DESIGN §5.3 field-by-field.

## Dependencies

09 (types locations), 04 (CI hook exists). Blocks 15, 16, 17, 18.

## Non-goals

Dataset content (15/16), resolution (17), rendering (18), POI registry (23).

## Design References

DESIGN §5.3, §12.2 A7; ADR-003, ADR-006 (flag mechanism).

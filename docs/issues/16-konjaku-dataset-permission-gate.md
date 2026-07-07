# Title

Add Konjaku Map dataset behind VITE_ENABLE_KONJAKU permission gate

## Summary

Add 今昔マップ historical-topo registry entries (initial regions: tokyo50, chukyo, keihansin)
behind the ADR-006 build flag (default OFF), including TMS y-flip handling verification and the
human permission-gate checklist.

## Context

Konjaku tiles require contacting Saitama University before public release
(research/konjaku-map-tiles.md §3). ADR-006 resolves this: fully implemented, flag-gated,
human-approved before ON.

## Scope

- `src/providers/layers/konjaku.layers.json`: entries for 3 regions × their eras. For each era of
  each region, transcribe from https://ktgis.net/kjmapw/tilemapservice.html at implementation
  time: the `{dataset}`/`{era}` URL path segments and the era year range. Entry pattern:
  - id: `konjaku-{region}-{from}` e.g. `konjaku-tokyo50-1896`
  - urlTemplate: `https://ktgis.net/kjmapw/kjtilemap/{dataset}/{era}/{z}/{x}/{y}.png` with
    `scheme: "tms"` (loader/overlay handle the y-flip via MapLibre `scheme` — DESIGN §6.2)
  - zoom: 8–16 (per research doc; verify per region), region "JP", provider "konjaku",
    coverage bbox per region (transcribe approximate extent from the service page maps)
  - `attribution.text`: `今昔マップ on the web`（required on-screen credit), url to ktgis.net
  - `flags: { experimental: true, requiresFeatureFlag: "VITE_ENABLE_KONJAKU" }`, priority 15
    (above GSI when era matches better — drawn maps are the richer old-era experience).
- Verification (recorded in PR): with the flag ON locally, 3 sample tiles per dataset render
  correctly positioned (y-flip correct) over the basemap; note any CORS/hotlink failure →
  if tiles fail, keep dataset committed, file findings on DESIGN §17.1.
- `docs/decisions/ADR-006`: append a "Gate checklist" section: [ ] owner contacted Saitama Univ.
  (date), [ ] permission scope recorded, [ ] flag enabled in deploy workflow. **Code must not
  flip the flag.**
- `.env.example` documenting `VITE_ENABLE_KONJAKU=false`.

## Detailed Requirements

1. CI and deploy never set the flag (grep workflows to assert).
2. With flag OFF: bundle may include the JSON (acceptable) but loader filters entries (14);
   resolve() must never return a konjaku id (test).
3. With flag ON in dev: slider ticks show konjaku eras; selecting 1900 in Tokyo resolves a
   konjaku layer (manual capture in PR).
4. Era year ranges: use the range midpoint convention exactly as printed on the service page;
   where a range is printed like `1896–1909`, era = {from:1896, to:1909}.

## Acceptance Criteria

- [ ] `validate:registry` green (host ktgis.net already allowlisted in 14).
- [ ] Unit: loader filters flagged entries when env flag absent; includes when set.
- [ ] Screenshot evidence of correct tile alignment (flag ON, dev) in PR; y-flip regression test:
      overlay manager e2e asserts tile URL row computed for a known z/x matches TMS expectation
      (stub captures requested URL).
- [ ] ADR-006 gate checklist added, all boxes unchecked.

## Validation

Unit + validator + dev-mode manual alignment evidence; no public deployment change.

## Dependencies

14. Human gate: Saitama University permission (outside agent scope — checklist only).

## Non-goals

Flipping the flag anywhere deployed; adding all 47 regions (post-permission follow-up); slider UI.

## Design References

ADR-006; research/konjaku-map-tiles.md; DESIGN §5.3, §6.2, §17.1.

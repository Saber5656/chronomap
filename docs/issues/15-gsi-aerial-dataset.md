# Title

Add GSI aerial-era dataset entries to the layer registry

## Summary

Populate `src/providers/layers/gsi.layers.json` with the nine GSI layers forming the v1 time axis
(1928 → present), with verified URL templates, zoom bounds, eras, approximate coverage bboxes,
and exact attribution strings.

## Context

research/gsi-tiles.md §2 lists the layers; DESIGN §6.1 consumes them via the registry (14). This
dataset is pure data — no code changes.

## Scope

Registry entries (ids fixed — referenced by tests and §6.1 step 6):

| id | tile id | era | zoom (src) | coverage bbox seed |
|---|---|---|---|---|
| `gsi-ort-1928` | `ort_1928` | 1928–1928 | 13–18 | Osaka [135.30,34.55,135.65,34.80] |
| `gsi-ort-riku10` | `ort_riku10` | 1936–1942 | 13–18 | Tokyo+Osaka two bboxes |
| `gsi-ort-usa10` | `ort_USA10` | 1945–1950 | 10–17 | major-cities multi-bbox (≥4 bboxes) |
| `gsi-ort-old10` | `ort_old10` | 1961–1969 | 10–17 | major-urban multi-bbox |
| `gsi-gazo1` | `gazo1` | 1974–1978 | 10–17 | Japan main islands bbox |
| `gsi-gazo2` | `gazo2` | 1979–1983 | 10–17 | Japan main islands bbox |
| `gsi-gazo3` | `gazo3` | 1984–1986 | 10–17 | Japan main islands bbox |
| `gsi-gazo4` | `gazo4` | 1987–1990 | 10–17 | Japan main islands bbox |
| `gsi-seamlessphoto` | `seamlessphoto` | 2007–null (rolling) | 14–18 | Japan incl. islands [122.9,20.4,154.0,45.6] |

URL templates: `https://cyberjapandata.gsi.go.jp/xyz/{tileid}/{z}/{x}/{y}.{png|jpg}` with the
extension per research/gsi-tiles.md §2. `scheme: "xyz"`, `tileSize: 256`, `region: "JP"`,
`provider: "gsi"`, `priority`: 10 (default), seamlessphoto 20.

## Detailed Requirements

1. **Verify at implementation time** against https://maps.gsi.go.jp/development/ichiran.html:
   (a) each URL template + extension by fetching one known tile per layer (record z/x/y and HTTP
   status in the PR description); (b) the per-layer 出典 attribution string from the ichiran page —
   copy it exactly into `attribution.text` (fallback: `地理院タイル（国土地理院）`).
2. Titles bilingual, pattern: ja `空中写真 1961–1969年`, en `Aerial photos 1961–1969`
   (1928: ja `大阪 空中写真 1928年頃`; riku10: ja `空中写真 1936–1942年（東京・大阪）`;
   seamlessphoto: ja `最新空中写真`, en `Latest aerial photos`).
3. Coverage bboxes: seed values above are starting approximations — refine by probing tile
   presence at zoom 12 grid corners if trivially possible, else keep seeds (404-transparency +
   coverage banner absorb inaccuracy; DESIGN §17.6).
4. Multi-bbox entries: usa10/old10 must cover at minimum Tokyo, Osaka, Nagoya, Fukuoka, Sapporo
   metro areas.

## Acceptance Criteria

- [ ] `npm run validate:registry` green; loader drops nothing.
- [ ] Unit fixture updated so resolve() tests (17) can use the real dataset ids.
- [ ] PR description contains the 9-row verification table (URL probed, status 200, attribution
      string source).
- [ ] Every entry has ja+en titles, license block, and `flags.requiresFeatureFlag: null`.

## Validation

`validate:registry` + one-time manual tile probes (curl, ≤ 2 requests/layer — politeness).

## Dependencies

14 (schema/loader/validator).

## Non-goals

Konjaku entries (16), rendering (18), coverage UI (21).

## Design References

research/gsi-tiles.md; DESIGN §5.3, §6.1; ADR-003, ADR-004.

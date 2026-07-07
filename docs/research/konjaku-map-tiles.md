# Research: 今昔マップ (Konjaku Map) Historical Topographic Tiles

Status: verified 2026-07-07 against https://ktgis.net/kjmapw/tilemapservice.html
Feeds: DESIGN.md §6, ADR-006, issue 16 (Konjaku dataset + permission gate).

## 1. Service summary

"今昔マップ on the web" (Saitama Univ., created by the late Prof. Kenji Tani) serves scanned old topographic maps (旧版地形図) as raster tiles for 47 Japanese regions, each with ~4–6 eras spanning roughly 1890s–2000s. This is the only practical free tile source for *drawn historical maps* (as opposed to aerial photos) covering multiple Japanese metro areas.

## 2. Technical facts

| Item | Value |
|---|---|
| URL template | `https://ktgis.net/kjmapw/kjtilemap/{dataset}/{era}/{z}/{x}/{-y}.png` |
| Y axis | **TMS (flipped y)** — Leaflet/QGIS notation `{-y}`; MapLibre raster source needs `scheme: "tms"` |
| Zoom | 8–16 (8–15 for Tohoku Pacific coast and Kanto datasets) |
| Regions | 47 datasets incl. `tokyo50`, `chukyo`, `keihansin`, `sapporo`, `sendai`, `hiroshima`, `fukuoka`, `kanto`, `niigata`, `okayama`, `kumamoto`, … |
| Eras | Region-specific; e.g. Tokyo spans 1896–1909 … 1992–1995 |
| Projection | Web Mercator XYZ tiling (with TMS row order) |

The per-region era identifiers (the `{era}` path segment) and their year ranges are listed on the service page per region; issue 16 must transcribe them exactly for the regions included in v1.

## 3. License / permission — **blocking condition found**

The service page requires:

1. On-screen credit text **「今昔マップ on the web」** must be displayed.
2. **For public release of an application using the tiles, contact Saitama University** (連絡が必要).

No explicit CC license is stated on the tile service page. Therefore:

- chronomap **must not enable the Konjaku provider in any public deployment until permission is confirmed** by the human owner contacting Saitama University.
- Decision recorded in ADR-006. Issue 16 implements the dataset entries and wiring behind a build-time feature flag defaulting to OFF, plus a human-gated checklist item.
- v1 can ship with GSI aerial layers only (license-clear) if permission is pending; the release checklist (issue 48) records the gate status.

## 4. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Permission not granted / no reply | No drawn-map layer in v1 | v1 remains complete with GSI aerial axis; Konjaku stays flag-OFF |
| Single-university server availability | Layer outages | Error tiles treated as transparent; no SLA assumed; provider marked `experimental` |
| CORS / hotlink policy unverified | Tiles may fail in browser | Verification step inside issue 16 before flag-ON request; raster tiles are loaded as images (no CORS needed for display, only for canvas readback which we do not do) |
| Era identifiers not machine-readable | Manual transcription errors | Issue 16 acceptance criteria include a recorded manual cross-check of 3 sample tiles per dataset |

## Sources

- https://ktgis.net/kjmapw/tilemapservice.html (fetched 2026-07-07)

# Research: GSI (国土地理院) Tile Layers

Status: verified 2026-07-07 against https://maps.gsi.go.jp/development/ichiran.html
Feeds: DESIGN.md §6 (time layers), issue 15 (GSI aerial-era dataset), issue 10 (basemap).

## 1. Base map layers (present day)

| Layer | Tile ID | URL template | Zoom | Notes |
|---|---|---|---|---|
| 標準地図 Standard | `std` | `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` | 5–18 | Primary basemap for Japan |
| 淡色地図 Pale | `pale` | `https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png` | 5–18 | Preferred as default: low-contrast, overlays read better |
| 全国最新写真 Seamless photo | `seamlessphoto` | `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` | 14–18 | "Present day" endpoint of the aerial time axis |

All are XYZ scheme (top-left origin, no y-flip), Web Mercator (EPSG:3857), 256px tiles.

## 2. Historical aerial photo layers (the v1 time axis)

| Tile ID | URL template (all under `https://cyberjapandata.gsi.go.jp/xyz/`) | Ext | Zoom | Period | Coverage |
|---|---|---|---|---|---|
| `ort_1928` | `ort_1928/{z}/{x}/{y}.png` | png | 13–18 | ~1928 | Osaka area only |
| `ort_riku10` | `ort_riku10/{z}/{x}/{y}.png` | png | 13–18 | 1936–1942 | Tokyo & Osaka areas |
| `ort_USA10` | `ort_USA10/{z}/{x}/{y}.png` | png | 10–17 | 1945–1950 | Major cities (US forces photography) |
| `ort_old10` | `ort_old10/{z}/{x}/{y}.png` | png | 10–17 | 1961–1969 | Major urban areas |
| `gazo1` | `gazo1/{z}/{x}/{y}.jpg` | jpg | 10–17 | 1974–1978 | Nationwide-ish (Selected areas) |
| `gazo2` | `gazo2/{z}/{x}/{y}.jpg` | jpg | 10–17 | 1979–1983 | Selected areas |
| `gazo3` | `gazo3/{z}/{x}/{y}.jpg` | jpg | 10–17 | 1984–1986 | Selected areas |
| `gazo4` | `gazo4/{z}/{x}/{y}.jpg` | jpg | 10–17 | 1987–1990 | Selected areas |
| `airphoto` | `airphoto/{z}/{x}/{y}.png` | png | 14–18 | 2004+ | Selected survey areas (optional) |
| `seamlessphoto` | `seamlessphoto/{z}/{x}/{y}.jpg` | jpg | 14–18 | current | Nationwide |

Implementation-relevant facts:

- Tiles outside a layer's coverage or zoom range return **HTTP 404**. The client must treat 404 tiles as transparent/no-data, not as an error toast.
- Native zoom ranges differ per layer. Below native minzoom or above maxzoom, MapLibre raster sources can overzoom/underzoom via source `minzoom`/`maxzoom` vs layer zoom range; issue 18 must set these per registry entry.
- `ort_riku10` / `ort_1928` have minzoom 13: at wider zooms the layer simply has no data — the coverage indicator (issue 21) must communicate this.
- Exact per-layer coverage polygons are not published as machine-readable data; v1 ships approximate bbox lists per registry entry (issue 15) and relies on 404-as-transparent for precision.

## 3. Terms of use / attribution

- GSI states real-time loading of 地理院タイル in websites/apps requires **attribution only, no application** ("出典の明示のみで申請不要").
- Required credit: 「国土地理院」/「地理院タイル」 with link to `https://maps.gsi.go.jp/development/ichiran.html`.
- Some historical photo layers are derived from US forces photography; the ichiran page lists per-layer 出典 strings. Issue 15 acceptance criteria: copy the exact per-layer 出典 string from the ichiran page into each registry entry's `attribution` field at implementation time.
- Bulk download / heavy automated access is discouraged; the app must not prefetch tiles beyond the viewport and the service worker must not cache tiles (DESIGN §10, ADR-005).

## 4. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Layer IDs or zoom ranges change | Broken layer | Registry is data, not code; contract test issue 44 pings 1 known tile per layer in CI (rate-limited, optional job) |
| Coverage gaps surprise users | Confusing blank map | 404-as-transparent + coverage indicator (issue 21) |
| GSI availability outage | Layer down | Error state design (issue 40); no SLA assumed |

## Sources

- https://maps.gsi.go.jp/development/ichiran.html (fetched 2026-07-07)

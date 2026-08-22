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
| Era identifiers not machine-readable | Manual transcription errors | Issue 16 acceptance criteria include a full manual cross-check of all selected region era identifiers and year ranges against the service page, plus sample tile probes |

## 5. Issue #17 implementation cross-check (2026-08-23)

The following table was manually cross-checked against the region tables on the official
[tile map service page](https://ktgis.net/kjmapw/tilemapservice.html). A single-year label on the
source page is represented as an inclusive {from, to} pair with the same year. Registry URLs
use {y} plus scheme: "tms"; the source page's {-y} notation is not copied into the registry.

| Region | Dataset | Printed years | Era folder | Registry ID |
|---|---|---:|---|---|
| Tokyo | tokyo50 | 1896–1909 | 2man | konjaku-tokyo50-1896 |
| Tokyo | tokyo50 | 1917–1924 | 00 | konjaku-tokyo50-1917 |
| Tokyo | tokyo50 | 1927–1939 | 01 | konjaku-tokyo50-1927 |
| Tokyo | tokyo50 | 1944–1954 | 02 | konjaku-tokyo50-1944 |
| Tokyo | tokyo50 | 1965–1968 | 03 | konjaku-tokyo50-1965 |
| Tokyo | tokyo50 | 1975–1978 | 04 | konjaku-tokyo50-1975 |
| Tokyo | tokyo50 | 1983–1987 | 05 | konjaku-tokyo50-1983 |
| Tokyo | tokyo50 | 1992–1995 | 06 | konjaku-tokyo50-1992 |
| Tokyo | tokyo50 | 1998–2005 | 07 | konjaku-tokyo50-1998 |
| Chukyo | chukyo | 1888–1898 | 2man | konjaku-chukyo-1888 |
| Chukyo | chukyo | 1920 | 00 | konjaku-chukyo-1920 |
| Chukyo | chukyo | 1932 | 01 | konjaku-chukyo-1932 |
| Chukyo | chukyo | 1937–1938 | 02 | konjaku-chukyo-1937 |
| Chukyo | chukyo | 1947 | 03 | konjaku-chukyo-1947 |
| Chukyo | chukyo | 1959–1960 | 04 | konjaku-chukyo-1959 |
| Chukyo | chukyo | 1968–1973 | 05 | konjaku-chukyo-1968 |
| Chukyo | chukyo | 1976–1980 | 06 | konjaku-chukyo-1976 |
| Chukyo | chukyo | 1984–1989 | 07 | konjaku-chukyo-1984 |
| Chukyo | chukyo | 1992–1996 | 08 | konjaku-chukyo-1992 |
| Keihanshin | keihansin | 1892–1910 | 2man | konjaku-keihansin-1892 |
| Keihanshin | keihansin | 1922–1923 | 00 | konjaku-keihansin-1922 |
| Keihanshin | keihansin | 1927–1935 | 01 | konjaku-keihansin-1927 |
| Keihanshin | keihansin | 1947–1950 | 02 | konjaku-keihansin-1947 |
| Keihanshin | keihansin | 1954–1956 | 03 | konjaku-keihansin-1954 |
| Keihanshin | keihansin | 1961–1964 | 03x | konjaku-keihansin-1961 |
| Keihanshin | keihansin | 1967–1970 | 04 | konjaku-keihansin-1967 |
| Keihanshin | keihansin | 1975–1979 | 05 | konjaku-keihansin-1975 |
| Keihanshin | keihansin | 1983–1988 | 06 | konjaku-keihansin-1983 |
| Keihanshin | keihansin | 1993–1997 | 07 | konjaku-keihansin-1993 |

Representative z14 requests for the first 2man era in each dataset returned
200 image/png for three neighboring tile coordinates per dataset on 2026-08-23:

| Dataset | TMS rows sampled | Result |
|---|---|---|
| tokyo50 | (14552,9932), (14553,9932), (14552,9931) | 3/3 PNG responses |
| chukyo | (14422,9903), (14423,9903), (14422,9902) | 3/3 PNG responses |
| keihansin | (14358,9877), (14359,9877), (14358,9876) | 3/3 PNG responses |

These HTTP probes verify that the published paths serve image tiles; they do not establish
permission for public use or replace a browser overlay alignment check. This repository revision
does not yet contain an overlay manager or browser test harness for the requested screenshot and
URL-row e2e assertion, so that visual gate remains pending until that downstream integration exists.

## Sources

- https://ktgis.net/kjmapw/tilemapservice.html (fetched 2026-07-07)

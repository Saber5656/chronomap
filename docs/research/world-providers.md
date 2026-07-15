# Research: World-Ready Provider Landscape (v2 premise)

Status: surveyed 2026-07-07. v1 ships Japan providers only; this research constrains the provider
abstraction (DESIGN.md §5.3, ADR-003) so world providers can be added without redesign.
Feeds: issues 14, 23; ISSUE_PLAN deferred items.

## 1. OpenHistoricalMap (OHM) — primary v2 candidate

| Item | Value |
|---|---|
| Data | Global, crowd-mapped historical vector features with per-feature date ranges |
| Vector tiles | `https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf` |
| Styles | MapLibre-compatible styles: https://github.com/OpenHistoricalMap/map-styles |
| Time filtering | `maplibre-gl-dates` plugin / filter on `start_decdate` & `end_decdate` feature properties |
| License | Data ODbL-family (verify at integration time); attribution required |

Architectural consequence: OHM is a **vector + date-filter** provider, unlike v1's raster-era model.
The v1 registry schema therefore has a `type` discriminator (`"raster-era"` now, `"vector-dated"`
reserved) and the layer resolution engine (issue 17) keys off provider type. v1 must not hardcode
"a time layer == one raster URL template" anywhere above the provider layer.

## 2. Other surveyed sources (v2+, not designed against)

| Source | Nature | Why deferred |
|---|---|---|
| David Rumsey / georeferenced IIIF maps | Global scanned maps | Per-map georeferencing, heavy API surface |
| NLS (National Library of Scotland) tiles | UK historical raster tiles | Regional; licensing per-series |
| USGS topoView | US historical topos | Regional; GeoTIFF-centric |
| Wikimedia Maps | Present-day world basemap | Usage policy restricts third-party apps; needs review before use as world basemap |

## 3. World basemap question (known unknown)

v1 uses GSI `pale`/`std` (Japan-optimized but renders worldwide at low zoom with sparse detail
outside Japan; GSI tiles legally serve any viewport). A proper world basemap (OSM raster policy
disallows heavy third-party hotlinking; vector alternatives like OpenFreeMap/Protomaps need
evaluation) is deferred — recorded in ISSUE_PLAN §known-unknowns and out of v1 scope: v1 targets
Japan usage; abroad, the app shows basemap-only with an "out of coverage" indicator.

## Sources

- https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Reuse
- https://github.com/OpenHistoricalMap/map-styles
- https://github.com/OpenHistoricalMap/mbgl-timeslider
- https://maplibre.org/maplibre-gl-js/docs/examples/create-a-time-slider/

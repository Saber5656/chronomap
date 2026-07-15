# ADR-003: Data-provider registry abstraction — Japan-first data, world-ready contract

Date: 2026-07-07 / Status: Accepted

## Context

Confirmed requirement: v1 implements Japan only, but issues must assume future world support.
Surveyed world providers (research/world-providers.md) differ structurally from v1's Japanese
sources: OHM is vector tiles + per-feature date filtering, while GSI/Konjaku are raster tiles
bound to an era interval.

## Decision

All "past" content is accessed through two registries, defined as **data + interfaces**, never
hardcoded into app logic:

1. **Time-layer registry** (`src/providers/layers/*.json` + JSON Schema): entries with a `type`
   discriminator. v1 implements `type: "raster-era"` (tile URL template, scheme xyz|tms, zoom
   bounds, era `{from,to}` years, coverage bboxes, region, attribution, license, flags).
   `type: "vector-dated"` is a reserved enum value with schema stub for OHM-class providers.
2. **POI provider registry** (`src/providers/poi/`): TS interface
   `PoiProvider { id, search(center, radiusM, locale, signal): Promise<Poi[]> }` with per-locale
   endpoint selection. v1 implements Wikipedia GeoSearch (+ Commons images behind a flag).

Region/language are first-class fields so a world provider is an added registry entry + provider
module, not a refactor. The layer-resolution engine (issue 17) consumes registry data only.

## Consequences

- v1 pays a small abstraction cost (schema + loader + discriminator) — bounded and specified in
  issues 14/23.
- Adding OHM later = new provider module + registry entries + a vector rendering path behind the
  existing `type` switch; no changes to slider, URL contract, or state model.
- Registry JSON is validated at build and load time; malformed entries fail closed (excluded, logged).

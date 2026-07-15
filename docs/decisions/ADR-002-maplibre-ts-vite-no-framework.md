# ADR-002: MapLibre GL JS + TypeScript + Vite, no UI framework

Date: 2026-07-07 / Status: Accepted

## Context

The UI is one full-screen map plus a small set of chrome components (time slider, bottom sheet,
buttons). Future world support points at OpenHistoricalMap **vector** tiles with date filtering,
which require a GL renderer (research/world-providers.md). Dependency surface must stay small for
supply-chain hygiene (OSS release, ADR-005), and issues must be executable by lower-capability
agents.

## Decision

- Renderer: **MapLibre GL JS v5.x** (pin `^5.24`, do not adopt v6 pre-releases).
- Language/build: **TypeScript (strict) + Vite**; PWA via `vite-plugin-pwa` (Workbox).
- UI: **no framework** (no React/Vue/Preact). Map chrome is built as small vanilla-TS components
  over a typed observable store (issue 09). DOM writes to component-owned subtrees only;
  external strings rendered via `textContent`, never `innerHTML`.
- Tests: Vitest (unit) + Playwright (e2e). Package manager: npm with committed lockfile.

## Consequences

- Leaflet was rejected: simpler for raster overlays, but no path to OHM vector+date rendering,
  weaker mobile gesture/rotation support.
- No-framework keeps runtime deps ≈ {maplibre-gl} and makes XSS discipline explicit (`textContent`
  rule is enforceable by lint + review), at the cost of hand-writing ~6 small components — accepted
  since the component inventory is fixed and small (DESIGN §8).
- Every issue that touches UI must specify exact DOM structure so weaker agents don't improvise
  (DESIGN §8 provides the component contracts).

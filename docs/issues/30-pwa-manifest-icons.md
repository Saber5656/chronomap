# Title

Add PWA web app manifest and icon set

## Summary

Add the web app manifest (via `vite-plugin-pwa` manifest config) with name, display, theme colors,
and the 192/512 + maskable icon set, making the app installable (share_target/protocol_handlers
land in 35/37).

## Context

DESIGN §10.1. Installability is a prerequisite for the Android share-sheet integration (W5) and
the home-screen "walk-and-explore" use case.

## Scope

- Dev dep `vite-plugin-pwa`; configure in `vite.config.ts` with `registerType: 'prompt'`,
  `injectRegister: false` (SW registration code is issue 31 — this issue may ship manifest with
  `devOptions` disabled and SW generation config present but unregistered, or split cleanly;
  document choice), and `manifest`:
  - `name: "chronomap — 時間旅行地図"`, `short_name: "chronomap"`, `lang: "ja"`,
    `display: "standalone"`, `orientation: "any"`, `start_url: "."`, `scope: "."`
    (base-relative for project pages — verify resolved URLs in built manifest),
    `theme_color`/`background_color` from design tokens (08).
  - `icons`: `pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png` (purpose `maskable`).
- Icon source: create `public/icons/` PNGs from a simple flat glyph (clock-hand over map-pin
  motif; single accent color on white / transparent). Author an SVG master
  (`public/icons/icon.svg`) and export PNGs (check-in PNGs; document export command). Keep it
  simple & geometric — no external assets, no fonts.
- `index.html`: `theme-color` meta, apple-touch-icon link (180px PNG), and
  `apple-mobile-web-app-*` metas for iOS standalone.

## Detailed Requirements

1. Manifest must validate in Chrome DevTools Application panel with zero installability warnings
   (except SW, pending 31).
2. All URLs in the built manifest must respect the `/chronomap/` base (06).
3. Icons: maskable safe-zone respected (glyph within inner 80%).
4. No icon generator dependencies added; a one-off local export is fine (record command in PR).

## Acceptance Criteria

- [ ] Built `dist/manifest.webmanifest` contains the fields above with base-correct URLs.
- [ ] Lighthouse installability check passes except missing-SW item.
- [ ] Icons render correctly in a maskable preview (screenshot in PR).
- [ ] e2e: manifest link tag present; fetching it via preview server returns valid JSON.

## Validation

`npm run build` + preview inspection; Lighthouse run recorded in PR.

## Dependencies

08 (tokens), 06 (base path decided).

## Non-goals

Service worker & update flow (31), share_target (35), protocol_handlers (37), screenshots/
richer install UI (v2).

## Design References

DESIGN §10.1, §16.

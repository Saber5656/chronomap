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

`npm run build` + `npm run validate:pwa` + the reproducible preview HTTP smoke check below.
Lighthouse/CDP evidence must be recorded separately; the build validator and HTTP smoke check do
not claim a Lighthouse pass.

## Implementation and evidence

The checked-in PNGs were exported from `public/icons/icon.svg` with the macOS built-in `sips`
command below. `pwa-maskable-512.png` intentionally uses the same 512px export; the validator
checks that its visible glyph remains inside the inner 80% safe zone.

```sh
for size in 180 192 512; do
  sips -s format png -z "$size" "$size" public/icons/icon.svg \
    --out "public/icons/pwa-$size.png"
done
cp public/icons/pwa-512.png public/icons/pwa-maskable-512.png
```

The build intentionally keeps `vite-plugin-pwa`'s generated `dist/sw.js`/Workbox artifact while
leaving it inert at runtime: `injectRegister: false` means this issue does not add
`virtual:pwa-register`, `navigator.serviceWorker.register`, or an update UI. Service-worker
registration and the prompt/update flow belong to follow-up #32; this boundary is asserted by
`npm run validate:pwa` and is not a license to implement that flow here.

The preview smoke check uses only Node's built-in `fetch` and can be reproduced with:

```sh
npm run build
npm run validate:pwa
npm run preview -- --host 127.0.0.1 --port 4173
npm run validate:pwa:preview -- http://127.0.0.1:4173/chronomap/
```

It fetches the base HTML, manifest, and every manifest PNG over HTTP and verifies status,
content type, manifest identity, and PNG signatures. No Lighthouse/CDP run is claimed by this
task unless separately recorded in the PR.

Chrome DevTools visual QA also opened the served `pwa-maskable-512.png` and overlaid the inner
80% circular safe-zone guide. The blue clock/pin glyph remained within the guide; this screenshot
was captured as review evidence and is summarized in the PR body. The source PNG and deterministic
`validate:pwa` safe-zone bounding-box check remain the reproducible repository evidence.

After the MapLibre bootstrap prerequisite (#11) was integrated, Chrome DevTools Lighthouse
navigation completed against the `/chronomap/` preview for both mobile and desktop. Scores were
Accessibility 100, Best Practices 96, SEO 90, and Agentic Browsing 100. The only reported audits
were the existing missing meta description and console-errors audit; direct console inspection was
empty and no PWA/installability failure was reported. A performance trace recorded LCP 106 ms and
CLS 0.00. The a11y snapshot exposed the Map region, GSI attribution link, Japanese document
language, and manifest URL.

## Dependencies

08 (tokens), 06 (base path decided).

## Non-goals

Service worker & update flow (31), share_target (35), protocol_handlers (37), screenshots/
richer install UI (v2).

## Design References

DESIGN §10.1, §16.

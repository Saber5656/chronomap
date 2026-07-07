# chronomap — v1 Issue Plan

Derived from `docs/DESIGN.md` (§ refs below). GitHub Issues are generated from `docs/issues/NN-*.md`;
this file is the roadmap/grouping layer. Issue numbers are **stable IDs**; execution order is
defined by the waves table (IDs and order intentionally diverge in one case: issue 39 executes in
Wave 1).

## 1. v1 completion statement

v1 is complete when: a user on a mobile browser can open the deployed PWA, locate themselves (or
arrive via a shared link / Android share sheet / geo: link / pasted URL), drag a time slider from
the 1890s to today and see GSI historical aerial imagery (and Konjaku maps when the ADR-006
permission flag is ON) crossfade over the basemap with correct attribution and coverage messaging,
browse nearby Wikipedia pins with detail sheets, hand any point off to Google/Apple Maps, install
the app as a PWA with offline app shell, in Japanese or English, with the §12 security posture
implemented and verified — and every issue 01–48 below is closed with its Validation section
satisfied. **Completing all 48 issues yields the v1 product; no product behavior exists outside
this plan.**

## 2. Implementation waves & execution order

| Wave | Goal | Issues (execution order) |
|---|---|---|
| W0 Foundation | repo builds, tests, deploys | 01, 02, 03, 04, 05, 06, 07 |
| W1 Map core | map + state + URL + location | 08, 09, **39 (i18n — executes here)**, 10, 11, 12, 13 |
| W2 Time layers | the time-travel core | 14, 15, 16, 17, 18, 19, 20, 21, 22 |
| W3 POI | Wikipedia pins | 23, 24, 25, 26, 27, 28, 29 |
| W4 PWA | installable + offline shell | 30, 31 |
| W5 Integrations | share in/out | 32, 33, 34, 36, 35, 37, 38 (36 before 35: share route falls back to ImportSheet) |
| W6 Polish | resilience + a11y + onboarding | 40, 41, 42 |
| W7 Security & release | harden, verify, ship | 43, 44, 45, 46, 47, 48 |

Within a wave, listed order is the recommended sequence; issues without mutual dependencies may
proceed in parallel (one branch/worktree per issue).

## 3. Issue list & dependency table

| ID | File | Title (short) | Blocked by | DESIGN refs |
|---|---|---|---|---|
| 01 | 01-vite-ts-scaffold.md | Vite + TS strict scaffold | — | §4.1 |
| 02 | 02-lint-format-toolchain.md | ESLint + Prettier | 01 | §12.5 |
| 03 | 03-vitest-unit-harness.md | Vitest harness | 01 | §15 |
| 04 | 04-ci-workflow.md | CI workflow (verify) | 02, 03 | §16, §12.5 |
| 05 | 05-license-and-notices.md | MIT LICENSE + notices | — | ADR-004 |
| 06 | 06-pages-deploy-workflow.md | Pages deploy + SPA 404 | 04 | §16, §9.3 |
| 07 | 07-playwright-e2e-harness.md | Playwright harness + stubs | 01, 04 | §15 |
| 08 | 08-app-shell-layout.md | App shell & layout | 01 | §8.1 |
| 09 | 09-state-store.md | Typed store + AppState | 03 | §5.1, §4.3 |
| 10 | 10-map-bootstrap-basemap.md | MapLibre + GSI basemap | 08, 09 | §6, §4.2 |
| 11 | 11-url-contract-and-validators.md | URL contract + boundary validators | 03, 09 | §5.2, §12.3 |
| 12 | 12-url-state-sync.md | URL ↔ state sync + share view | 10, 11 | §5.2, §3.5 |
| 13 | 13-geolocation-module.md | Geolocation + locate button | 10 | §3.1, §13 |
| 14 | 14-layer-registry-schema-loader.md | Registry schema + loader | 09 | §5.3, ADR-003 |
| 15 | 15-gsi-aerial-dataset.md | GSI aerial-era dataset | 14 | research/gsi-tiles.md |
| 16 | 16-konjaku-dataset-permission-gate.md | Konjaku dataset + gate | 14 | ADR-006, research/konjaku |
| 17 | 17-layer-resolution-engine.md | resolve() engine | 14, 15 | §6.1 |
| 18 | 18-raster-overlay-manager.md | Overlay manager | 10, 14 | §6.2 |
| 19 | 19-time-slider-ui.md | Time slider UI | 09, 17, 18 | §6.3 |
| 20 | 20-opacity-control.md | Opacity control | 18 | §8 #4 |
| 21 | 21-coverage-indicator.md | Coverage banner | 17, 19 | §6.4 |
| 22 | 22-attribution-layers-sheet.md | Attribution badge + Layers sheet | 18, 19 | §6.5, ADR-004 |
| 23 | 23-poi-provider-interface.md | POI provider interface | 09 | §5.4, ADR-003 |
| 24 | 24-wikimedia-client-core.md | Wikimedia client core | 23 | §7.1, §12.3 |
| 25 | 25-wikipedia-geosearch-provider.md | GeoSearch provider | 24 | §7.1, research/wikimedia |
| 26 | 26-wikipedia-summary-provider.md | Summary provider | 24 | §7.3, §5.4 |
| 27 | 27-poi-map-rendering.md | Pin rendering layer | 10, 25 | §7.2 |
| 28 | 28-poi-detail-sheet.md | POI detail sheet | 26, 27 | §7.3, §8.3 |
| 29 | 29-commons-old-photos.md | Commons photos (flagged) | 24, 28 | §7.4 |
| 30 | 30-pwa-manifest-icons.md | Manifest + icons | 08 | §10.1 |
| 31 | 31-service-worker-app-shell.md | SW app shell + update | 30 | §10.2, §12.2 A10 |
| 32 | 32-outbound-map-handoff.md | Outbound handoff | 12 | §9.4 |
| 33 | 33-longpress-point-picker.md | Long-press point picker | 12, 32 | §8 #2, §3.5 |
| 34 | 34-shared-location-parser.md | Shared-location parser | 11 | §9.2, §12.2 A3/A4 |
| 35 | 35-share-target-route.md | /share route + share_target | 30, 34, 36 | §9.3 |
| 36 | 36-import-paste-fallback.md | ImportSheet paste fallback | 34 | §8 #10, §9.3 |
| 37 | 37-geo-protocol-handler.md | geo: protocol handler | 35 | §9.3, research/map-app |
| 38 | 38-ios-shortcuts-recipe.md | iOS Shortcuts recipe (docs) | 35 | §9.5 |
| 39 | 39-i18n-ja-en.md | i18n module (ja/en) | 08 | §11.1 |
| 40 | 40-error-offline-states.md | Error/offline states + Toast | 10, 19, 24 | §13 |
| 41 | 41-accessibility-baseline.md | A11y baseline pass | 19, 28, 36 | §11.2 |
| 42 | 42-onboarding-coach.md | Onboarding coach | 13, 19 | §3.1 |
| 43 | 43-csp-and-security-meta.md | CSP + security meta | 10, 25, 31 | §12.4 |
| 44 | 44-security-abuse-test-suite.md | Abuse-case test suite | 11, 34, 26, 43 | §12.2 |
| 45 | 45-supply-chain-policy.md | Supply chain + SECURITY.md | 04 | §12.5 |
| 46 | 46-perf-budget-lighthouse.md | Perf budgets + Lighthouse CI | 06, 31 | §14 |
| 47 | 47-about-credits-privacy-docs.md | About/credits/privacy + README | 22, 28 | §12.6, ADR-004 |
| 48 | 48-release-0-1-0.md | Release v0.1.0 | all 01–47 | §16, ADR-006 |

## 4. Coverage: DESIGN.md § → issues

| DESIGN section | Covered by |
|---|---|
| §3 UX flows | 13, 19, 21, 28, 35, 36, 42 |
| §4 architecture/boot | 01, 08, 09, 10, (routes) 35 |
| §5.1 state | 09 · §5.2 URL | 11, 12 · §5.3 registry | 14, 15, 16 · §5.4 POI model | 23 |
| §6.1 | 17 · §6.2 | 18 · §6.3 | 19 · §6.4 | 21 · §6.5 | 22 |
| §7.1 | 24, 25 · §7.2 | 27 · §7.3 | 26, 28 · §7.4 | 29 |
| §8 components | 08, 19, 20, 13(#5), 22(#6), 21(#7), 27(#8 toggle), 28/36(#9,10), 32/33(#11 menu), 40(#12), 42(#13) |
| §9.2 | 34 · §9.3 | 35, 36, 37, 06 · §9.4 | 32, 33 · §9.5 | 38 |
| §10 | 30, 31 |
| §11.1 | 39 · §11.2 | 41 |
| §12.1–12.3 | 11, 24, 34, 44 · §12.4 | 43 · §12.5 | 04, 45 · §12.6 | 47 |
| §13 | 40 (+13, 21, 36 for their local states) |
| §14 | 46 · §15 | 03, 07, 44, 46 · §16 | 04, 06, 48 |

Every DESIGN section maps to ≥1 issue; issue 48's checklist re-verifies this table before release.

## 5. Whole-product validation strategy

1. Per-issue: each issue's Validation section (unit/e2e/manual) must pass in CI before merge.
2. Cross-cutting regression: e2e suite (07) grows with W1/W2/W3/W5 issues; all upstream network
   stubbed — CI never depends on GSI/Wikimedia availability (DESIGN §15).
3. Security verification: issue 44 encodes DESIGN §12.2 A1–A10 as executable regressions; issue 43
   verified via e2e CSP-violation listener; issue 45 gates CI.
4. Pre-release: issue 48 runs the manual device matrix (iOS Safari / Android Chrome), live-provider
   smoke (rate-limited, manual), Lighthouse budgets (46), and the ADR-006 permission gate check.

## 6. Deferred to v2 (do not implement in v1)

OpenHistoricalMap `vector-dated` provider + world basemap; geocoding search; device-local
bookmarks; Wikidata date-filtered POIs; swipe-compare view; Capacitor wrapper + iOS native share
target; DMS coordinate parsing; optional last-view restore; Commons strip promotion out of flag.

## 7. Known unknowns → possible new issues during implementation

Tracked list = DESIGN §17. Rule for implementers: when an unknown resolves into work that exceeds
its owning issue's scope, open a new `docs/issues/NN-*.md` (next free number) via PR rather than
widening the existing issue. Candidates most likely to spawn issues: Konjaku permission outcome
(ADR-006), MapLibre-vs-CSP relaxations (§12.4), Google share-URL format drift (§9.2).

# chronomap — v1 Design

Status: Draft for implementation. Owner-confirmed requirements: 2026-07-07.
Companion documents: `docs/ISSUE_PLAN.md`, `docs/issues/*.md`, `docs/decisions/ADR-001…006`, `docs/research/*.md`.
Section numbers (§) are stable identifiers referenced by issues. Do not renumber without updating ISSUE_PLAN coverage table.

---

## §1 Product overview

chronomap is a mobile-first web app (PWA) that lets a user stand anywhere in Japan, open the app,
and slide back through time: the map under their feet changes to aerial photography of the 1980s,
1960s, 1940s… and (permission-gated) drawn topographic maps back to the 1890s, with nearby
Wikipedia places surfaced as pins.

Core loop: **open → locate → drag the time slider → recognize "this used to be…" → tap pins to
read → share the exact view**.

Target user: general public in Japan (walkers, local-history fans, families), not GIS experts.
UI languages: Japanese (default for `ja` locales) and English.

## §2 Scope

### §2.1 v1 in scope

1. Full-screen slippy map with GSI basemap (pale default).
2. Time slider (1890s → current year) switching historical raster layers:
   - GSI aerial-photo eras (license-clear, always on): `ort_1928`, `ort_riku10`, `ort_USA10`,
     `ort_old10`, `gazo1–4`, `seamlessphoto` (research/gsi-tiles.md).
   - Konjaku Map drawn topo eras behind build flag `VITE_ENABLE_KONJAKU`, default OFF (ADR-006).
3. Past-layer opacity control over the present basemap.
4. Coverage indication when the selected era has no data at the current view.
5. Geolocation on explicit user action only; no auto-prompt on load.
6. POI pins from Wikipedia GeoSearch + detail sheet (summary, thumbnail, link); Commons old-photo
   strip behind flag `VITE_ENABLE_COMMONS_PHOTOS` (best-effort).
7. Deep-link URL contract (§5.2); share-current-view (copy link + Web Share API).
8. Inbound integrations: Web Share Target (Android), `/share` route, `geo:` protocol handler,
   paste-to-open fallback, iOS Shortcuts recipe (docs).
9. Outbound handoff to Google/Apple Maps and `geo:`.
10. PWA installability; app-shell offline (map data explicitly NOT offline).
11. i18n ja/en; baseline accessibility (§11); error/degraded states (§13).
12. Security posture per ADR-005 and §12.

### §2.2 v1 non-goals (explicit)

- No accounts, no server, no user-generated content, no social features.
- No place-name/address search (geocoding) — arrive by location, pan, or shared link.
- No offline map data, no tile prefetch/bulk download.
- No route/navigation features; no 3D/terrain.
- No persistence of map position between sessions (privacy-lean default).
- No analytics/telemetry.
- No year-filtering of POI pins (pins are place-based, not date-based, in v1).
- No native iOS share-sheet target (OS limitation; Shortcuts recipe instead).

### §2.3 v2 deferred (recorded, not designed here)

OpenHistoricalMap world layer (`vector-dated`), world basemap selection, geocoding search,
bookmarks (device-local), Wikidata date-filtered POIs, swipe/split compare view, Capacitor
native wrapper (iOS share extension), 度分秒 coordinate parsing, last-view restore option.

## §3 UX flows

### §3.1 First run
1. Load `/` → Japan overview (center 36.5, 138.5, zoom 5), year = current, POI off by default at
   this zoom (auto-enabled visual only at zoom ≥13 — see §7.1; toggle state itself defaults ON).
2. One-time onboarding coach (3 tooltips: slider, locate button, share/import menu) — dismissible,
   `localStorage["chronomap.onboarded"]="1"`.
3. Tap locate → browser permission prompt → map flies to fix (zoom 15) → slider hint pulses once.

### §3.2 Time travel
Drag slider (or ←/→ keys) → year label updates live → on release (or 150 ms settle) the layer
resolution (§6.1) runs → crossfade to resolved layer (§6.2) → era badge shows layer title +
attribution; if no coverage at view → "no imagery for {year} here" banner (§6.4).

### §3.3 POI browse
At zoom ≥13 with POI on: pins refresh on map idle (§7.1). Tap pin → bottom sheet with title,
thumbnail, plain-text extract, "Wikipedia →" link, "open in map app" button (§9.4). Sheet closes by
X, swipe-down, or Android back (history integration §8.3).

### §3.4 Inbound share (Android) / paste (all platforms)
Share from Google/Apple Maps → chronomap appears in share sheet (installed PWA) → `/share?text=…`
→ parser (§9.2) → success: redirect to `/?lat…` and toast "opened shared location"; failure
(shortlink/no coords): Import sheet opens pre-filled with guidance (§9.3).

### §3.5 Outbound handoff
From POI sheet or long-press menu on map point → "Open in Google Maps / Apple Maps / other app
(geo:)" → external app opens at that coordinate.

## §4 Architecture

### §4.1 Repository layout (target state after v1)

```
├── index.html                  # single page; CSP meta (§12.4)
├── public/                     # icons, static assets
├── src/
│   ├── main.ts                 # boot sequence (§4.2)
│   ├── app/                    # appShell.ts, routes.ts (/ vs /share), onboarding.ts
│   ├── state/                  # store.ts (observable store), appState.ts (types), urlState.ts (§5.2)
│   ├── map/                    # mapController.ts, overlayManager.ts (§6.2), poiLayer.ts (§7.2)
│   ├── providers/
│   │   ├── layers/             # registry.schema.json, gsi.layers.json, konjaku.layers.json,
│   │   │                       # loader.ts (validate), resolve.ts (§6.1)
│   │   └── poi/                # types.ts, wikimediaClient.ts, wikipediaGeosearch.ts,
│   │                           # wikipediaSummary.ts, commonsImages.ts
│   ├── integrations/           # parseSharedLocation.ts (§9.2), outbound.ts (§9.4), shareRoute.ts
│   ├── security/               # validate.ts — ALL boundary validators (§12.3)
│   ├── ui/                     # components/*.ts (§8), styles/*.css, i18n/ (§11.1)
│   └── util/                   # geo.ts (haversine, bbox), lru.ts, dom.ts (el() helper)
├── tests/
│   ├── unit/                   # vitest specs + fixtures/ (canned API JSON)
│   └── e2e/                    # playwright specs + stubs/ (tile + API interception)
├── .github/workflows/          # ci.yml, deploy.yml (§16)
└── docs/                       # this corpus
```

### §4.2 Boot sequence (main.ts)

1. `routes.dispatch(location)` — if path is `/share`, run share flow (§9.3) which ends in a
   `location.replace(BASE + '?…')` or renders Import sheet; otherwise continue.
2. `urlState.parse(location.search)` → validated partial state (§5.2); merge into defaults.
3. Create store (§5.1); mount AppShell (§8).
4. `loader.loadRegistries()` → validated layer registry (build-time imported JSON, validated again
   at runtime; invalid entries dropped with `console.warn`).
5. Init MapLibre (§6), init slider/chrome from registry, run first layer resolution.
6. Register service worker (§10.2). Never call geolocation before user gesture.

### §4.3 Runtime data flow

```
URL params ──validate──▶            ┌─▶ overlayManager ──▶ MapLibre raster layers
share text ──parse────▶  store ─────┼─▶ TimeSlider / badges / sheets (subscribe)
user gestures ────────▶ (single     ├─▶ urlState.write (debounced replaceState)
geolocation fix ──────▶  source of  └─▶ poi controller ──▶ wikimediaClient ──▶ pins
map moveend ──────────▶  truth)
```

All mutations go through typed store actions; components never write each other's state.

## §5 Data models

### §5.1 AppState (state/appState.ts)

```ts
interface AppState {
  view: { lat: number; lng: number; zoom: number };            // clamped §12.3
  year: number;                                                 // YEAR_MIN..currentYear
  requestedLayerId: string | null;                              // URL `l` override, resolved by §6.1
  timeLayer: {
    activeLayerId: string | null;                               // resolved by §6.1
    opacity: number;                                            // 0..1, default 1
    resolution: { candidates: string[]; reason: 'ok'|'no-coverage'|'registry-empty' };
  };
  poi: {
    enabled: boolean;                                           // default true
    status: 'idle'|'loading'|'ready'|'error'|'below-zoom';
    items: Poi[];                                               // ≤ POI_MAX (50)
    selectedId: string | null;
  };
  geo: {
    status: 'idle'|'requesting'|'granted'|'denied'|'unavailable';
    fix: { lat: number; lng: number; accuracyM: number; at: number } | null;
  };
  ui: {
    sheet: 'none'|'poi'|'layers'|'about'|'import';
    toast: { id: number; kind: 'info'|'error'; text: string } | null;
    lang: 'ja'|'en';
  };
}
```

Constants: `YEAR_MIN = 1890`, `POI_MIN_ZOOM = 13`, `POI_MAX = 50`, `ZOOM_MIN = 2`, `ZOOM_MAX = 18`.

Store: `createStore(initial)` returning `{ get(), set(patch), on(selector, cb) }` — ~60 lines, no
external dependency, fully unit-tested (issue 09).

### §5.2 URL contract v1 (public, stable — state/urlState.ts)

Query parameters on `/` (order-insensitive; unknown params ignored; all optional):

| Param | Type / range | Meaning | Default |
|---|---|---|---|
| `lat` | float −90..90, ≤6 dp | view center | 36.5 |
| `lng` | float −180..180, ≤6 dp | view center | 138.5 |
| `z` | float 2..18, ≤2 dp | zoom | 5 |
| `year` | int 1890..currentYear | time position | currentYear |
| `l` | layer id, `[a-z0-9-]{1,64}`, must exist in registry | explicit layer override (§6.1 step 0) | none |
| `op` | int 0..100 | past-layer opacity % | 100 |
| `poi` | `0`\|`1` | POI toggle | 1 |
| `label` | string ≤120 chars after URL-decode; control chars stripped | pin label from shared source | none |

Rules: parse with `security/validate.ts`; any invalid value → fall back to that param's default
(never reject the whole URL); `label` renders via `textContent` only and never enters URL builders.
Serialization: `history.replaceState` debounced 500 ms after `moveend`/year/opacity/poi changes;
params at defaults are omitted. `/share` route params are defined in §9.3, not here.
Versioning: contract is additive-only; if a breaking change is ever required, introduce `v=2`.

### §5.3 Time-layer registry schema (providers/layers/registry.schema.json)

JSON Schema (draft 2020-12) for an array of entries:

```jsonc
{
  "id": "gsi-ort-old10",              // ^[a-z0-9-]{1,64}$, unique
  "type": "raster-era",               // enum: "raster-era" | "vector-dated" (reserved, ADR-003)
  "provider": "gsi",                  // "gsi" | "konjaku" (extensible)
  "title": { "ja": "空中写真 1961–1969", "en": "Aerial photos 1961–1969" },
  "era": { "from": 1961, "to": 1969 },        // ints, from ≤ to
  "region": "JP",                              // ISO 3166-1 alpha-2 or "GLOBAL"
  "coverage": [[128.0,30.0,146.5,45.8]],       // array of [minLng,minLat,maxLng,maxLat]
  "tiles": {
    "urlTemplate": "https://cyberjapandata.gsi.go.jp/xyz/ort_old10/{z}/{x}/{y}.png",
    "scheme": "xyz",                            // "xyz" | "tms"
    "minzoom": 10, "maxzoom": 17, "tileSize": 256
  },
  "attribution": { "text": "地理院タイル（国土地理院）",
                   "url": "https://maps.gsi.go.jp/development/ichiran.html" },
  "license": { "name": "GSI Terms (attribution only)", "url": "…" },
  "flags": { "experimental": false, "requiresFeatureFlag": null },  // e.g. "VITE_ENABLE_KONJAKU"
  "priority": 10                                // higher wins ties (§6.1)
}
```

Validation gates: (a) build-time script `npm run validate:registry` (CI, issue 14); (b) runtime
loader drops invalid entries (fail-closed). `urlTemplate` host must be on the CSP allowlist (§12.4)
— checked by the build-time validator against a committed host list.

### §5.4 POI model & provider interface (providers/poi/types.ts)

```ts
interface Poi {
  id: string;                 // provider-scoped, e.g. "wikipedia-ja:12345"
  title: string;              // ≤ 300 chars enforced
  lat: number; lng: number;
  distanceM?: number;
  source: { provider: 'wikipedia'|'commons'; lang: string; url: string };  // https only
}
interface PoiDetail {
  extract: string;            // PLAIN TEXT, ≤1200 chars enforced (truncate + ellipsis)
  thumbnailUrl?: string;      // https, host ∈ allowlist (upload.wikimedia.org)
  pageUrl: string;
  attributionKey: 'wikipedia-ccbysa';
}
interface PoiProvider {
  id: string;
  minZoom: number;
  search(q: { lat: number; lng: number; radiusM: number; locale: 'ja'|'en';
              signal: AbortSignal }): Promise<Poi[]>;
}
```

All provider responses pass `security/validate.ts` schema guards before entering the store (§12.3).

## §6 Time-layer subsystem

### §6.1 Layer resolution algorithm (providers/layers/resolve.ts — pure function)

```
resolve(year, viewBbox, zoom, registry, currentYear, requestedLayerId?)
  -> { activeLayerId | null, reason, candidates }

0. if requestedLayerId exists in enabled registry AND type=="raster-era" AND coverage intersects
   viewBbox AND zoom within tiles.minzoom..maxzoom → pick it (reason 'ok').
1. enabled = entries minus (flags.requiresFeatureFlag set and flag not enabled at build).
2. candidates = enabled where type=="raster-era" AND coverage intersects viewBbox
   AND zoom within tiles.minzoom..maxzoom
   (bbox intersection; antimeridian not handled in v1 — Japan-only data).
3. if candidates empty → { null, reason: registry empty ? 'registry-empty' : 'no-coverage' }.
4. score(e) = (year within e.era) ? 0 : min(|year − e.era.from|, |year − e.era.to|).
5. pick minimal score; ties → smaller (era.to − era.from), then higher priority, then id asc.
6. Special case: if year ≥ currentYear − 2 → prefer the entry flagged provider=="gsi" &&
   id=="gsi-seamlessphoto" when among candidates (present-day photo).
```

Deterministic; unit-tested with a fixture registry (issue 17). Note: `seamlessphoto` era is
`{from: 2007, to: currentYear}` (rolling), regenerated at build from `new Date()` in loader.

### §6.2 Overlay manager (map/overlayManager.ts)

- Owns MapLibre sources/layers `chronomap-past` (raster) inserted above basemap, below POI layer.
- `setLayer(entry | null, opacity)`: if changing, add new source+layer with `raster-opacity: 0`,
  animate to `opacity` over 250 ms (rAF), then remove the old pair. Rapid changes coalesce: at most
  one transition in flight; the latest request wins.
- `scheme: "tms"` entries set MapLibre raster source `scheme: "tms"` (Konjaku, research doc).
- Tile 404s render as missing/transparent (default MapLibre behavior); no toast (expected case).
- `setOpacity(v)` adjusts paint property without relayout.

### §6.3 Time slider (ui/components/TimeSlider.ts)

- Range `YEAR_MIN..currentYear`, step 1. Era tick marks derived from registry (all enabled
  entries); ticks whose entry is not in current `candidates` render dimmed.
- Thumb drag updates `year` live (label follows); layer resolution runs on 150 ms settle.
- Keyboard: `←/→` ±1 year, `Shift+←/→` ±10, `Home/End` min/max. ARIA: `role=slider`,
  `aria-valuemin/max/now`, `aria-valuetext="{year}年 — {active layer title}"`.
- Hit target ≥ 44px; bottom-safe-area aware (§8.1).

### §6.4 Coverage indication (ui/components/CoverageBanner.ts)

Rendered when `timeLayer.resolution.reason == 'no-coverage'` OR resolved layer score > 0:
- no-coverage: banner "この年代の画像はこの場所にはありません" + nearest available era chip
  (tap → jumps year).
- score > 0 (snapped): passive badge "表示中: {layer title}"（selected year outside layer era).

### §6.5 Attribution & era badge (ui/components/LayerInfoBadge.ts)

Always-visible compact badge: active layer title + provider attribution text (tap → Layers sheet
listing basemap + active overlay + their attribution/license links). MapLibre's built-in
attribution control stays enabled for the basemap. Satisfies ADR-004 runtime-attribution rule.

## §7 POI subsystem

### §7.1 Fetch policy (poi controller in map/poiLayer.ts + providers/poi/)

Trigger: map `idle` event. Conditions (all): `poi.enabled`, `zoom ≥ POI_MIN_ZOOM`, center moved
> 25% of viewport diagonal since last fetch OR radius bucket changed. Debounce 300 ms; single
in-flight request (AbortController; new fetch aborts old). Radius =
`clamp(round(viewportDiagonalM / 2), 100, 10000)`. `gslimit=50`.
Locale: `ui.lang == 'ja' → ja.wikipedia.org`, else `en.wikipedia.org`.
Cache: LRU 200, key `${provider}:${lang}:${lat3dp}:${lng3dp}:${radiusBucket}`, session lifetime.
Headers: `Api-User-Agent: chronomap/{version} (+repo URL)` (research/wikimedia-geodata-api.md).
Below zoom: status `below-zoom`, pins hidden, pill hint "ズームすると周辺の記事が出ます".

### §7.2 Pin rendering (map/poiLayer.ts)

GeoJSON source + MapLibre `symbol`+`circle` layers (not DOM markers). Collision handled by symbol
placement. Selected pin: `feature-state: {selected: true}` → larger/accented. Tap tolerance 8px.
Source updates diffed by `Poi.id` to avoid flicker.

### §7.3 Detail sheet (ui/components/PoiSheet.ts)

On pin tap: sheet opens with title immediately; summary fetch (§5.4 PoiDetail) fills extract +
thumbnail (skeleton while loading; error → retry affordance). Buttons: "Wikipedia で読む"
(external, `rel="noopener noreferrer"`), "地図アプリで開く" (§9.4). Attribution footer:
"Text: Wikipedia (CC BY-SA)". All strings via i18n keys.

### §7.4 Commons old photos (flag `VITE_ENABLE_COMMONS_PHOTOS`)

Horizontal thumbnail strip inside PoiSheet region (or standalone "nearby old photos" entry in
Layers sheet — v1 keeps it inside PoiSheet). Commons geosearch `gsnamespace=6` around the POI;
`extmetadata.DateTimeOriginal < 1990` best-effort filter; failures silent (strip hidden). Marked
experimental in UI.

## §8 UI component inventory & contracts

Every component: `mount(parent: HTMLElement, store) → { destroy() }`; owns its subtree; renders
external strings with `textContent`; styles in co-named CSS file; i18n via keys (§11.1).

| # | Component | Contract (state in → events out) |
|---|---|---|
| 1 | AppShell | grid: map region + slider dock + corner controls + sheet host + toast host; safe-area (`env(safe-area-inset-*)`) |
| 2 | MapView | owns MapLibre instance; in: view/timeLayer/poi; out: `moveend`, `idle`, pin tap, long-press (600 ms touch / right-click) |
| 3 | TimeSlider | §6.3 |
| 4 | OpacityControl | vertical mini-slider or 3-state button (100/60/0%); in: opacity; out: setOpacity |
| 5 | LocateButton | states idle/requesting/granted/denied (§13.2); out: requestLocate |
| 6 | LayerInfoBadge | §6.5 |
| 7 | CoverageBanner | §6.4 |
| 8 | PoiToggle | pin icon toggle; reflects poi.enabled |
| 9 | BottomSheet host | renders one of PoiSheet/LayersSheet/AboutSheet/ImportSheet; swipe-down + X close |
| 10 | ImportSheet | textarea + "開く" → parser (§9.2); shows reason-specific guidance on failure |
| 11 | MenuButton | opens: share view (copy/Web Share), import, about, language |
| 12 | Toast | single slot, auto-dismiss 4 s, `aria-live=polite` |
| 13 | OnboardingCoach | §3.1 |

### §8.3 Sheet ↔ history integration

Opening a sheet does `history.replaceState({sheet}, '')`; `popstate` closes the active sheet
(Android back / iOS edge-swipe) without stacking one entry per sheet transition. Guard against
state desync: on `popstate`, if no sheet open, ignore.

## §9 Integration contracts

### §9.1 Deep link — §5.2 is the single public URL contract.

### §9.2 Shared-location parser (integrations/parseSharedLocation.ts — pure, no I/O)

`parseSharedLocation(raw: string): ParseResult` per research/map-app-integration.md §2.
Input cap: 4096 chars (reject beyond, reason `invalid`). Recognizers in order: `geo:` URI →
Apple `maps.apple.com` (`ll`, optional `q` label) → Google full URLs
(`q=`, `query=`, `/@lat,lng,{z}z`, including `maps.google.co.jp`) →
Google/goo.gl shortlink hosts → reason `shortlink` → generic plain `lat,lng` pair →
otherwise `no-coords`. Never fetches (ADR-005). Output coords re-validated (§12.3). Label:
decoded, control-stripped, ≤120 chars. Table-driven test suite ≥ 25 cases incl. adversarial
(issue 34).

### §9.3 Base-relative share route, path ending `/share` (integrations/shareRoute.ts)

Registered in manifest `share_target`: `{ action: "share", method: "GET",
params: { title: "title", text: "text", url: "url" } }` and `protocol_handlers`:
`[{ protocol: "geo", url: "share?text=%s" }]` (research doc §1). Flow: concat `url ?? text ?? title`
→ parser → ok: `location.replace(BASE + '?lat=…&lng=…&z={zoom??16}&label=…')`; fail: render app with
ImportSheet open, prefilled raw text (truncated for display), guidance keyed by reason
(`shortlink` → "共有リンクは短縮URLでした。マップアプリで『座標をコピー』するか、URL全体を貼り付けてください").
GitHub Pages SPA: deploy copies `index.html` → `404.html` so `/chronomap/share` and any path ending
`/share` resolves (issue 06).

### §9.4 Outbound handoff (integrations/outbound.ts)

Exact URLs per research doc §3; built only from validated numeric state; `label` never interpolated
into outbound URLs. UI: buttons in PoiSheet + long-press context menu ("ここを起点に時間旅行" /
"地図アプリで開く"). `window.open(url, '_blank', 'noopener,noreferrer')`.

### §9.5 iOS Shortcuts recipe

`docs/integrations/ios-shortcut.md` (issue 38): steps to build a Shortcut receiving share-sheet
URLs and opening `https://{host}/share?text=[input]`. Optional published iCloud link added
manually by owner at release.

## §10 PWA

### §10.1 Manifest
`name: "chronomap"`, `short_name: "chronomap"`, `display: "standalone"`, `start_url: "."`,
`scope: "."`,
`theme_color`/`background_color` from design tokens, icons 192/512 + maskable (issue 30),
`share_target` + `protocol_handlers` per §9.3.

### §10.2 Service worker (vite-plugin-pwa / Workbox, issue 31)
- Precache: built app shell (hashed assets) only.
- Runtime: **NetworkOnly for all cross-origin** (tiles, APIs) — no caching (provider ToS + privacy,
  ADR-005). Navigation fallback → `index.html` (`/share` included).
- Update flow: `registerType: 'prompt'`; on waiting SW → toast "新しいバージョンがあります [更新]"
  → skipWaiting + reload.

## §11 i18n & accessibility

### §11.1 i18n (ui/i18n/)
`strings.ja.json` / `strings.en.json`, flat keys (`slider.aria`, `share.fail.shortlink`, …).
`t(key, vars?)` with `{var}` interpolation; missing key → key itself + console.warn (CI check:
key parity between locales, issue 39). Initial lang: `navigator.language` startsWith `ja` → ja;
manual toggle in menu persists to `localStorage["chronomap.lang"]`.

### §11.2 Accessibility baseline (issue 41 checklist)
Slider/controls keyboard-operable; visible focus; contrast ≥ 4.5:1 for text on chrome; touch
targets ≥ 44px; `aria-live` for toast + year announcements (throttled); `prefers-reduced-motion`
→ disable crossfade/fly animations; sheet focus trap + Esc close on desktop.

## §12 Security model

### §12.1 Trust boundaries

```
[User gestures]──────────────▶ B5 Geolocation (permission-gated, user-initiated only)
[URL / deep link]───B1──▶ validate.ts ─▶ store      [Share payload text]───B2──▶ parser (§9.2)
[Wikimedia JSON]────B3──▶ schema guards ─▶ store    [Tile servers (images)]─B4─▶ <img>/GL texture
[npm deps / GH Actions]─B6──▶ lockfile + SHA pinning + audit gate (§12.5)
```

Trusted: our static bundle (integrity = Pages over HTTPS + SW precache revisioning).
Untrusted: B1, B2, B3 payload *content*; B4 availability; B6 third-party code at build time.

### §12.2 Abuse cases → required defenses

| # | Abuse case | Defense (issue) |
|---|---|---|
| A1 | Crafted deep link injects script via `label`/params | strict param validation, `textContent`-only rendering, CSP backstop (11, 43, 44) |
| A2 | `lat=1e309&z=NaN` style fuzzing breaks map state | `Number.isFinite` + clamp all numerics; fuzz tests (11, 44) |
| A3 | Malicious shared text (huge, binary, RTL tricks, `javascript:` URI) | 4096-char cap, scheme allowlist (`geo:`/`https:` hosts), control-char strip (34, 44) |
| A4 | App induced to fetch attacker URL (SSRF-from-client / tracking pixel) | parser never fetches; egress limited by CSP connect/img allowlists (34, 43) |
| A5 | Hostile Wikimedia response (compromised/api spoof via DNS): oversized/HTML extract | response schema guards, length caps, plain-text field only, thumbnail host allowlist (24, 26) |
| A6 | Open redirect via outbound buttons | outbound URLs built from numerics only, hardcoded hosts (32) |
| A7 | Registry JSON tampering in PR adds exfil host | registry validator checks tile hosts ⊆ committed allowlist; CSP as runtime backstop (14, 43) |
| A8 | Coord leakage via Referer to Wikipedia/tile hosts | `<meta name="referrer" content="no-referrer">` + noopener/noreferrer (43) |
| A9 | Supply-chain: typosquat/compromised dep or action | minimal deps, lockfile, `npm audit` gate, SHA-pinned actions, Dependabot (04, 45) |
| A10 | SW update serving stale/poisoned shell | Workbox revisioned precache, prompt-update flow, no cross-origin caching (31) |

### §12.3 Input validation rules (security/validate.ts — single module, issue 11 + 24)

- `latLng(lat, lng)`: finite, ranges, round 6 dp. `zoom(z)`: finite, clamp 2..18. `year(y)`:
  int, clamp 1890..currentYear. `opacity(v)`: int 0..100 → /100.
- `label(s)`: NFC-normalize, strip C0/C1 + bidi control chars, trim, ≤120 chars.
- `poiTitle(s)` ≤300; `extract(s)` ≤1200; `httpsUrl(s, allowedHosts)` → URL parse, protocol
  `https:`, host ∈ allowlist, else reject.
- Geosearch/summary responses: structural guards (arrays, numbers finite, strings typed) — reject
  item-wise, never `eval`-adjacent parsing, JSON only.

### §12.4 CSP & document policies (issue 43)

`index.html` meta CSP (Pages cannot set headers — ADR-001):

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:
  https://cyberjapandata.gsi.go.jp https://upload.wikimedia.org;
connect-src 'self' https://ja.wikipedia.org https://en.wikipedia.org
  https://commons.wikimedia.org; worker-src 'self' blob:; child-src blob:; manifest-src 'self';
base-uri 'none'; form-action 'none'; object-src 'none'
```

Konjaku-enabled builds append `https://ktgis.net` to `img-src` only when the same build-time flag
that enables Konjaku registry entries is ON; the default v1 policy omits that host.

Plus `<meta name="referrer" content="no-referrer">`. Verification item: MapLibre GL runtime may
require `style-src` relaxation (blob workers use `worker-src blob:` and older engines may fall back
to `child-src blob:` — verify) — resolve during issue 43 with documented final policy; any
relaxation needs written justification in the issue.
`frame-ancestors` cannot be expressed in meta CSP → residual clickjacking risk accepted & documented.

### §12.5 Supply chain & CI security (issues 04, 45)

Runtime deps target: `maplibre-gl` only. Dev deps: vite, typescript, vitest, playwright,
vite-plugin-pwa, eslint+configs, prettier. `package-lock.json` committed; CI `npm ci` only.
`npm audit --omit=dev --audit-level=high` gate (deps) + advisory job for devDeps. GitHub Actions
pinned to full commit SHAs; workflow `permissions:` minimal per job (§16). Dependabot: npm +
github-actions, weekly. `SECURITY.md`: private vulnerability reporting via GitHub.

### §12.6 Privacy disclosures (issue 47)

In-app About: (a) location processed on-device only; (b) map tiles reveal viewed area to GSI (and
ktgis.net if enabled); (c) POI feature sends map center to Wikimedia when enabled at zoom ≥13;
(d) no cookies/analytics/tracking; (e) localStorage keys used (`lang`, `onboarded`) and how to clear.

## §13 Error handling & degraded states

| Condition | UX |
|---|---|
| Offline / tile fetch fails (basemap) | Map shows blank tiles + toast once "オフラインのようです"; app shell still works |
| Past layer tile 404 (out of coverage) | expected: transparent + CoverageBanner (§6.4); NO toast |
| Wikimedia API error / timeout (8 s) | poi.status=error → pin area pill "記事を取得できませんでした（再試行）" |
| Geolocation denied | LocateButton state `denied`; sheet explains browser re-enable path; app fully usable without |
| Geolocation unavailable (insecure ctx/no HW) | button hidden, status `unavailable` |
| Registry invalid at runtime | drop entries (fail-closed); if all dropped → slider disabled + Layers sheet shows error |
| `/share` parse failure | ImportSheet with reason-specific guidance (§9.3) |
| SW update waiting | prompt toast (§10.2) |

Timeout policy: all fetches `AbortSignal.timeout(8000)`. Retry: manual only (no auto-retry storms).

## §14 Performance budgets (issue 46 enforces via Lighthouse CI)

- Initial JS ≤ 350 KB gzip total (MapLibre dominates); CSS ≤ 40 KB; lazy-load Playwright-irrelevant
  extras (About content, onboarding) via dynamic import.
- LCP < 2.5 s / TTI < 3.5 s on Moto G-class 4G profile; Lighthouse PWA + Perf ≥ 90 on CI run.
- ≤ 1 POI request per idle; tile requests = viewport-only (no prefetch).
- Main-thread long tasks: crossfade via rAF opacity only (no per-frame layout).

## §15 Testing & validation strategy

| Level | Tooling | What (owning issues) |
|---|---|---|
| Unit | Vitest | urlState parse/serialize incl. fuzz (11), resolve() fixtures (17), parseSharedLocation table (34), validators (11/24), store (09), LRU/geo utils |
| Contract fixtures | Vitest + committed JSON | geosearch/summary happy+malformed responses (24–26); registry schema valid/invalid samples (14) |
| E2E | Playwright (chromium mobile viewport; webkit smoke) | boot→slider→layer swap with stubbed tiles; POI tap→sheet; /share ok+fallback; deep link; offline shell (31); all network stubbed — zero real upstream calls in CI (07) |
| Security | Vitest fuzz + e2e abuse cases | §12.2 A1–A6 regression pack (44) |
| A11y | manual checklist + Lighthouse a11y ≥ 90 | issue 41 |
| Perf | Lighthouse CI (budgets §14) | issue 46 |
| Live smoke (optional, rate-limited) | manual `npm run smoke:providers` | 1 real tile per layer + 1 geosearch — run before release only (48), never in CI |

Definition of Done for every issue: code + tests listed in the issue + docs touched + CI green.

## §16 Build, CI/CD, release

- `ci.yml` (PRs + main): job `verify` = `npm ci` → registry validate → lint → typecheck → unit →
  build → e2e (chromium) → `npm audit` gate. `permissions: contents: read`.
- `deploy.yml` (main, after verify): build → upload-pages-artifact → deploy-pages;
  `permissions: pages: write, id-token: write`. All actions SHA-pinned (§12.5).
- Vite `base` configured for project-pages path; `404.html` = copy of `index.html` (§9.3).
- Release v0.1.0 (issue 48): CHANGELOG (keep-a-changelog), tag, deploy verification, release
  checklist incl.: Konjaku flag state vs ADR-006 permission status, THIRD_PARTY_NOTICES refresh,
  live smoke pass, privacy note review.

## §17 Known unknowns (tracked in ISSUE_PLAN; may spawn new issues)

1. Konjaku permission outcome + tile CORS/hotlink behavior (ADR-006; issue 16 verification step).
2. Exact per-layer GSI attribution strings & any zoom-range drift (issue 15 verify-at-impl).
3. MapLibre GL vs strict CSP (`worker-src blob:`? inline style?) — final policy in issue 43.
4. Google Maps share URL format drift over time (parser table is data-driven; add cases as found).
5. iOS Safari standalone-PWA geolocation quirks (permission re-prompts) — device test at issue 48.
6. Coverage bbox fidelity for era layers (approximation acceptable? refine post-v1 if confusing).
7. Wikipedia REST thumbnail sizing params (issue 26 verify).
8. World basemap for v2 (research/world-providers.md §3) — out of v1.

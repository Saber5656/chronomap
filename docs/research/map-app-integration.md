# Research: Map-App Integration Surfaces (Share Target, Deep Links, geo:)

Status: verified 2026-07-07.
Feeds: DESIGN.md §9 (integration contracts), issues 32–38.

## 1. Inbound share support matrix

| Surface | Android | iOS | Desktop |
|---|---|---|---|
| Web Share **Target** (manifest `share_target`) | ✅ Chrome/Chromium ≥71, installed PWA required | ❌ Not implemented in Safari/WebKit (open request: WebKit bug 194593) | ❌ (Chrome OS only, N/A) |
| `geo:` link → PWA protocol handler | ✅ where manifest `protocol_handlers` honored | ❌ | ✅ Chromium/Firefox via `registerProtocolHandler` |
| Apple Shortcuts recipe (share sheet → Shortcut → opens chronomap URL) | n/a | ✅ works today, ships as recipe + docs, no app code | n/a |
| Paste URL/coords into in-app import box | ✅ | ✅ | ✅ (universal fallback) |

Key consequences:

- iOS share-sheet integration in v1 = **Shortcuts recipe + paste fallback**, not native. Native share extension requires a wrapper app → v2 deferred.
- `geo` **is on the HTML safelist** for `registerProtocolHandler`/manifest `protocol_handlers` (alongside mailto, sms, etc.), so no `web+` prefix is needed.
- `share_target` config: `method: "GET"`, params map `text`/`url`/`title` → `/share?…` route. Google Maps shares arrive as `text` containing a URL on Android.

## 2. Location URL formats to parse (issue 34 — string parsing only, the app never fetches user-supplied URLs)

| Source | Example pattern | Extractable |
|---|---|---|
| geo URI | `geo:35.68,139.76?z=15` | lat,lng,zoom |
| Plain coords | `35.681236, 139.767125` (also 度分秒 variants out of scope v1) | lat,lng |
| Google Maps `q`/`query` | `https://www.google.com/maps?q=35.68,139.76`, `…/maps/search/?api=1&query=35.68,139.76` | lat,lng |
| Google Maps path `@` | `https://www.google.com/maps/@35.68,139.76,15z` (also `…/place/NAME/@lat,lng,15z`) | lat,lng,zoom |
| Google short link | `https://maps.app.goo.gl/…`, `https://goo.gl/maps/…` | **Not parseable client-side** (redirect target unreadable cross-origin) → explicit unsupported result + guidance UI |
| Apple Maps | `https://maps.apple.com/?ll=35.68,139.76&q=Label`, `?address=…` (no coords → unsupported) | lat,lng (from `ll`), label (from `q`, sanitized) |

Parser contract: pure function `parseSharedLocation(text: string) → { ok: true, lat, lng, zoom?, label? } | { ok: false, reason: 'shortlink' | 'no-coords' | 'invalid' }`. Never performs network I/O (security: prevents the app from pinging attacker-controlled URLs).

## 3. Outbound handoff formats (issue 32)

| Target | URL |
|---|---|
| Google Maps | `https://www.google.com/maps/search/?api=1&query={lat},{lng}` |
| Apple Maps | `https://maps.apple.com/?ll={lat},{lng}` |
| geo: (Android chooser) | `geo:{lat},{lng}?z={zoom}` |

All built from validated numeric state only; hosts hardcoded; links use `rel="noopener noreferrer"` + app-wide `<meta name="referrer" content="no-referrer">` so current view coords never leak via Referer.

## 4. iOS Shortcuts recipe outline (issue 38)

1. Share sheet from Apple/Google Maps → Shortcut receives URL/text.
2. Shortcut action "Open URL": `https://{host}/share?text=[Shortcut Input (URL-encoded)]` — reuses the same `/share` route + parser as Web Share Target, keeping one code path.
3. Distribution: step-by-step doc with screenshots placeholder + optional iCloud shortcut link added at release time by the human owner (link creation is a manual step).

## Sources

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
- https://developer.chrome.com/docs/capabilities/web-apis/web-share-target
- https://bugs.webkit.org/show_bug.cgi?id=194593
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/protocol_handlers
- https://developer.chrome.com/docs/web-platform/best-practices/url-protocol-handler

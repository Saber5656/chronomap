# Title

Implement /share route and Web Share Target registration

## Summary

Register the PWA as an Android share target (manifest `share_target`) and implement the `/share`
GET route: parse → redirect to a deep link, or open the ImportSheet fallback with reason-specific
guidance.

## Context

DESIGN §9.3 + §3.4. This is the "share from Google Maps → chronomap opens in 1965" moment on
Android; the same route serves geo: protocol (37) and the iOS Shortcut (38) — one code path.

## Scope

- Manifest (30's config): add
  `share_target: { action: "share", method: "GET", params: { title: "title", text: "text",
  url: "url" } }` (relative action under base — verify resolved path `/chronomap/share`).
- `src/app/routes.ts` + `src/integrations/shareRoute.ts` (boot step 1, §4.2):
  - Detect path endsWith `/share` (base-aware).
  - Input: `url` ?? `text` ?? `title` (first non-empty; ALSO try concatenation `text + ' ' + url`
    if the first alone fails — Android apps vary in field usage).
  - `parseSharedLocation` (34):
    - ok → `location.replace(BASE + '?lat={lat}&lng={lng}&z={zoom ?? 16}' + (label ? '&label=…' :
      '') )` (URL-encoded via URLSearchParams; year deliberately NOT set — user lands at current
      year and time-travels themselves).
    - fail → boot the app normally at default view with ImportSheet open (36), prefilled with the
      raw input (display-truncated to 500 chars) and the reason-keyed guidance string.
  - `history.replaceState` after handling so `/share?...` never remains in the address bar.
- `label` handling: when present, show the picked-point marker (33's `chronomap-picked` source)
  at the target with the label rendered in a small callout (textContent; 33's marker infra reused).

## Detailed Requirements

1. The route must work: (a) in-browser (manual URL), (b) installed PWA share flow, (c) offline
   (SW navigation fallback, 31).
2. No open-redirect: `location.replace` target is always same-origin BASE-prefixed (assert in code).
3. Raw shared text is never logged, stored, or sent anywhere; it dies with the parse.
4. e2e cannot drive the OS share sheet — test the route contract directly (URL-level) + document
   one manual Android verification in the PR (screen recording or step list result).

## Acceptance Criteria

- [ ] e2e: `/share?text=geo:35.68,139.76` → lands `/?lat=35.68&lng=139.76&z=16`, camera correct.
- [ ] e2e: `/share?url=https://maps.apple.com/?ll=34.70,135.49%26q=Osaka` → deep link with
      label param; marker + callout visible.
- [ ] e2e: `/share?text=https://maps.app.goo.gl/abc` → ImportSheet open with shortlink guidance;
      address bar cleaned.
- [ ] Manifest validates; Android manual test evidence attached (installed app appears in share
      sheet and opens correctly) — human/device step recorded.

## Validation

`tests/e2e/share-route.spec.ts` + one manual on-device pass (owner or maintainer with Android).

## Dependencies

30 (manifest), 34 (parser), 36 (ImportSheet), 33 (marker reuse), 06 (SPA 404 fallback).

## Non-goals

POST/file share targets, iOS share sheet (38 recipe), shortlink expansion (never).

## Design References

DESIGN §9.3, §3.4, §4.2; research/map-app-integration.md §1.

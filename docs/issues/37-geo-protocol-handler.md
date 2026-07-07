# Title

Register geo: protocol handler (manifest + optional runtime registration)

## Summary

Register chronomap as a `geo:` URI handler via manifest `protocol_handlers` (installed PWA) and an
opt-in `registerProtocolHandler` call (desktop browsers), both routing through `/share`.

## Context

research/map-app-integration.md §1: `geo` is on the HTML safelist. This gives chronomap a
standards-based inbound path from any app emitting geo links (no share sheet needed).

## Scope

- Manifest (30's config): `protocol_handlers: [{ protocol: "geo", url: "share?text=%s" }]`
  (base-relative; verify built form resolves to `/chronomap/share?text=%s`).
- Runtime (desktop): in AboutSheet (47) or MenuButton, an opt-in item i18n `menu.registerGeo`
  (`geoリンクをこのアプリで開く`) → `navigator.registerProtocolHandler('geo',
  '{origin}{base}share?text=%s')` guarded by feature detection + try/catch (some browsers
  restrict); success/failure toast. Shown only when the API exists.
- `/share` route (35) already handles `text=geo:…` — no new parsing.
- Document behavior matrix in `docs/integrations/protocol-handler.md` (10 lines: which
  browsers/OS honor manifest vs runtime registration, per research doc).

## Detailed Requirements

1. Registration must never run automatically (user gesture + explicit menu action only).
2. The `%s` value arrives URL-encoded — confirm 35's route decodes exactly once (URLSearchParams
   does; add a regression test with double-encoded input expecting failure NOT double-decode).
3. No behavior change for browsers without support (item hidden).

## Acceptance Criteria

- [ ] Built manifest contains the protocol_handlers entry with base-correct URL.
- [ ] e2e: simulate handler invocation by navigating `/share?text=geo%3A35.68%2C139.76` → correct
      deep link (this also pins the single-decode contract).
- [ ] e2e: menu item hidden when API absent (override in test); visible + calls API when present
      (spy) with exact template string.
- [ ] Double-encoded regression test passes (goes to ImportSheet, not to wrong coords).

## Validation

`tests/e2e/protocol.spec.ts`; manual desktop Chrome check recorded in PR (chrome://settings/handlers).

## Dependencies

30 (manifest), 35 (route).

## Non-goals

`web+chronomap:` custom scheme (unneeded), Android intent filters (n/a for PWA), auto-registration.

## Design References

DESIGN §9.3; research/map-app-integration.md §1.

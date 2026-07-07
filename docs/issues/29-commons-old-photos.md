# Title

Add Wikimedia Commons nearby old-photos strip (feature-flagged)

## Summary

Behind `VITE_ENABLE_COMMONS_PHOTOS`, add a best-effort horizontal thumbnail strip of nearby old
photographs (Commons geosearch ns=6 + extmetadata date filter) inside the POI sheet.

## Context

DESIGN §7.4. Date metadata on Commons is inconsistent — this is explicitly best-effort,
experimental, silent-on-failure, and must never degrade the core sheet.

## Scope

- `src/providers/poi/commonsImages.ts`:
  - Geosearch on `commons.wikimedia.org` (`gsnamespace=6`, radius 500 m around the selected POI,
    `gslimit=20`) → titles; then one batched
    `action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&titles=…` request (≤20
    titles, pipe-joined).
  - Filter: `extmetadata.DateTimeOriginal.value` parseable year < 1990; map to
    `{ thumbUrl (httpsUrl allowlist upload.wikimedia.org), pageUrl (commons.wikimedia.org),
      year }`; cap 10 items.
  - Both requests via wikimediaClient (24); cache key `commons:{lat3dp}:{lng3dp}`.
- UI: `CommonsStrip` section in PoiSheet under the extract: header i18n `photos.nearbyOld`
  (`近くの古い写真（実験的）`), horizontal scroll of 96px thumbs with year chip; tap → opens the
  Commons file page externally (noopener). Any error/empty → section entirely hidden (no error UI).
- Registry hook `getPhotoProvider()` (23) returns this provider when flag set.

## Detailed Requirements

1. Requests fire only when the sheet is open AND flag on AND POI selected; abort on close.
2. Zero requests when flag off (build-time dead-code eliminated via `import.meta.env` guard —
   verify bundle grep).
3. Attribution: strip footer `photos.commonsCredit` (`Photos: Wikimedia Commons — 各ファイルの
   ライセンスはリンク先参照`) — per-file license display is v2.
4. Date parse: accept `YYYY`, `YYYY-MM-DD`, `d MMMM YYYY` prefixes; else drop item.

## Acceptance Criteria

- [ ] Unit: date-filter table (≥8 formats incl. garbage), mapping, allowlist rejection, cap 10.
- [ ] e2e (flag ON in test build): strip renders fixtures; flag OFF build → no strip, no requests.
- [ ] e2e: Commons 500 stub → sheet unaffected, strip hidden.
- [ ] Bundle check documented in PR: flag-off build contains no `commons.wikimedia.org` string.

## Validation

`npm run test` + flag-matrix e2e (two build configs in the spec's `webServer` setup or via
`import.meta.env` injection — document approach chosen).

## Dependencies

24, 28 (sheet slot), 23 (registry hook).

## Non-goals

Promoting out of flag (v2 decision), per-photo licenses, photo viewer/lightbox, date-filtering pins.

## Design References

DESIGN §7.4, §2.3; research/wikimedia-geodata-api.md §3.

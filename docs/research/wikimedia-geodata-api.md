# Research: Wikimedia APIs for Historical POI Pins

Status: verified 2026-07-07 (Extension:GeoData docs) + established MediaWiki API behavior.
Feeds: DESIGN.md §7 (POI pipeline), issues 23–29.

## 1. Wikipedia GeoSearch (`list=geosearch`, GeoData extension)

Endpoint (per language): `https://{lang}.wikipedia.org/w/api.php`

| Param | Value / limit |
|---|---|
| `action=query&list=geosearch` | module selector |
| `gscoord` | `{lat}\|{lon}` two floats separated by pipe |
| `gsradius` | meters, **10–10000 max** |
| `gslimit` | **max 500** (anon); v1 uses ≤50 |
| `gsnamespace` | `0` articles (Wikipedia), `6` files (Commons) |
| `gsprop` | optional: `type\|name\|country\|region` |
| `format=json&origin=*` | JSON + anonymous CORS |

Response items: `pageid`, `ns`, `title`, `lat`, `lon`, `dist`, `primary`.

## 2. Page summaries (REST v1)

`https://{lang}.wikipedia.org/api/rest_v1/page/summary/{encoded title}`

- Returns `title`, `extract` (**plain text** — use this, never `extract_html`), `thumbnail{source,width,height}`, `content_urls.desktop.page`, `coordinates`.
- CORS-enabled for anonymous GET.
- To be verified during issue 26 implementation: exact thumbnail sizing params.

## 3. Wikimedia Commons nearby images

Same GeoSearch module on `https://commons.wikimedia.org/w/api.php` with `gsnamespace=6`. Image metadata (dates) via `prop=imageinfo&iiprop=extmetadata` (`DateTimeOriginal`). Date metadata quality is inconsistent → "old photo" filtering is **best-effort** and the feature ships behind a flag (issue 29).

## 4. Etiquette, limits, privacy

- Wikimedia asks API clients for a descriptive User-Agent. Browsers cannot set `User-Agent`; MediaWiki accepts the **`Api-User-Agent`** header instead (CORS-allowed). Value: `chronomap/{version} (https://github.com/Saber5656/chronomap)`.
- No hard published per-IP rate limit for anonymous reads, but clients must be conservative: v1 policy = max 1 in-flight geosearch, ≥300 ms debounce after map idle, LRU cache (200 entries, session lifetime), no request when POI layer disabled or zoom < 13.
- **Privacy boundary**: geosearch sends the *map center* (not raw GPS fix) to Wikimedia. After "locate me", map center ≈ user location — this data flow must be disclosed in the privacy note (issue 47) and DESIGN §12 threat model.
- Attribution: article text extracts are CC BY-SA; the POI sheet must link to the source article and credit Wikipedia (issue 28).

## 5. Data quality caveats

- GeoSearch returns *anything with coordinates* (schools, stations, mountains), not only "historical" content. v1 presents pins as "places with stories nearby" rather than promising historical events; filtering by category/Wikidata dates is deferred to v2 (ISSUE_PLAN §deferred).
- Language: `ja.wikipedia.org` for `ja` locale, `en.wikipedia.org` otherwise; provider registry carries the language mapping (issue 25).

## Sources

- https://www.mediawiki.org/wiki/Extension:GeoData (fetched 2026-07-07)
- https://www.mediawiki.org/wiki/API:Etiquette , https://www.mediawiki.org/wiki/API:Cross-site_requests (established behavior; re-verify headers in issue 24)

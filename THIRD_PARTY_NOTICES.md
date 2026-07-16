# Third Party Notices

This file separates the chronomap code license from third-party package notices and data-source
attribution requirements. The application code is licensed under the MIT License in `LICENSE`.
Map tiles, article text, and other data sources remain subject to their providers' own terms and
required attribution, even in forks.

## Bundled npm packages

To be generated and verified during release issue 48.

## Data sources & required attributions

| Source | Required on-screen credit | Terms / source URL | Notes |
|---|---|---|---|
| GSI tiles | 地理院タイル（国土地理院） | https://maps.gsi.go.jp/development/ichiran.html | GSI tile use requires attribution. Some historical aerial photo layers may have per-layer source strings that must be copied into registry attribution at implementation time. |
| Konjaku Map | 今昔マップ on the web | https://ktgis.net/kjmapw/tilemapservice.html | Public deployment is gated by ADR-006. Do not enable the Konjaku provider publicly until the owner records permission from Saitama University. |
| Wikipedia / Wikimedia | Wikipedia text: CC BY-SA | Source article URL + https://creativecommons.org/licenses/by-sa/4.0/ | Article extracts are credited to Wikipedia and must link back to the source article; Wikimedia API behavior and attribution are tracked in `docs/research/wikimedia-geodata-api.md`. |

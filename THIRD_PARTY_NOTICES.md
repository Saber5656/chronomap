# Third Party Notices

This file separates the chronomap code license from third-party package notices and data-source
attribution requirements. The application code is licensed under the MIT License in `LICENSE`.
Map tiles, article text, and other data sources remain subject to their providers' own terms and
required attribution, even in forks.

## Bundled npm packages

<!-- license-checker:production:start -->

Generated from the production dependency tree on 2026-08-23.

Summary command (the summary includes the private application package as `UNLICENSED`):

```text
├─ MIT: 9
├─ ISC: 8
├─ BSD-3-Clause: 3
├─ BSD-2-Clause: 2
├─ (MIT OR Apache-2.0): 1
└─ UNLICENSED: 1
```

The package table uses the corresponding JSON command and excludes the private application package:

```sh
./node_modules/.bin/license-checker --production --summary
./node_modules/.bin/license-checker --production --json --excludePrivatePackages
```

| Package                           | Version   | License             | Repository                                              |
| --------------------------------- | --------- | ------------------- | ------------------------------------------------------- |
| @mapbox/jsonlint-lines-primitives | 2.0.3     | MIT                 | https://github.com/mapbox/jsonlint                      |
| @mapbox/point-geometry            | 1.1.0     | ISC                 | https://github.com/mapbox/point-geometry                |
| @mapbox/tiny-sdf                  | 2.2.0     | BSD-2-Clause        | https://github.com/mapbox/tiny-sdf                      |
| @mapbox/unitbezier                | 1.0.0     | BSD-2-Clause        | https://github.com/mapbox/unitbezier                    |
| @mapbox/vector-tile               | 3.0.0     | BSD-3-Clause        | https://github.com/mapbox/vector-tile-js                |
| @maplibre/geojson-vt              | 6.1.1     | ISC                 | https://github.com/maplibre/geojson-vt                  |
| @maplibre/maplibre-gl-style-spec  | 26.2.1    | ISC                 | https://github.com/maplibre/maplibre-style-spec         |
| @maplibre/mlt                     | 1.1.12    | (MIT OR Apache-2.0) | https://github.com/maplibre/maplibre-tile-spec          |
| @maplibre/vt-pbf                  | 4.3.2     | MIT                 | https://github.com/maplibre/vt-pbf                      |
| @types/geojson                    | 7946.0.16 | MIT                 | https://github.com/DefinitelyTyped/DefinitelyTyped      |
| earcut                            | 3.2.3     | ISC                 | https://github.com/mapbox/earcut                        |
| gl-matrix                         | 3.4.4     | MIT                 | https://github.com/toji/gl-matrix                       |
| json-stringify-pretty-compact     | 4.0.0     | MIT                 | https://github.com/lydell/json-stringify-pretty-compact |
| kdbush                            | 4.1.0     | ISC                 | https://github.com/mourner/kdbush                       |
| maplibre-gl                       | 6.3.0     | BSD-3-Clause        | https://github.com/maplibre/maplibre-gl-js              |
| minimist                          | 1.2.8     | MIT                 | https://github.com/minimistjs/minimist                  |
| murmurhash-js                     | 1.0.0     | MIT                 | https://github.com/mikolalysenko/murmurhash-js          |
| pbf                               | 5.1.2     | BSD-3-Clause        | https://github.com/mapbox/pbf                           |
| potpack                           | 2.1.0     | ISC                 | https://github.com/mapbox/potpack                       |
| protocol-buffers-schema           | 3.6.1     | MIT                 | https://github.com/mafintosh/protocol-buffers-schema    |
| quickselect                       | 3.0.0     | ISC                 | https://github.com/mourner/quickselect                  |
| resolve-protobuf-schema           | 2.1.0     | MIT                 | https://github.com/mafintosh/resolve-protobuf-schema    |
| tinyqueue                         | 3.0.0     | ISC                 | https://github.com/mourner/tinyqueue                    |

<!-- license-checker:production:end -->

## Data sources & required attributions

| Source                | Required on-screen credit  | Terms / source URL                                                   | Notes                                                                                                                                                                                |
| --------------------- | -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GSI tiles             | 地理院タイル（国土地理院） | https://maps.gsi.go.jp/development/ichiran.html                      | GSI tile use requires attribution. Some historical aerial photo layers may have per-layer source strings that must be copied into registry attribution at implementation time.       |
| Konjaku Map           | 今昔マップ on the web      | https://ktgis.net/kjmapw/tilemapservice.html                         | Public deployment is gated by ADR-006. Do not enable the Konjaku provider publicly until the owner records permission from Saitama University.                                       |
| Wikipedia / Wikimedia | Wikipedia text: CC BY-SA   | Source article URL + https://creativecommons.org/licenses/by-sa/4.0/ | Article extracts are credited to Wikipedia and must link back to the source article; Wikimedia API behavior and attribution are tracked in `docs/research/wikimedia-geodata-api.md`. |

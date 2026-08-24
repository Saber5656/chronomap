# Third Party Notices

This file separates the chronomap code license from third-party package notices and data-source
attribution requirements. The application code is licensed under the MIT License in `LICENSE`.
Map tiles, article text, and other data sources remain subject to their providers' own terms and
required attribution, even in forks.

## Bundled npm packages

<!-- license-checker:production:start -->

Generated from the production dependency tree on 2026-08-24.

Summary of non-private packages in the root and mobile production dependency graph:

```text
├─ MIT: 393
├─ ISC: 32
├─ Apache-2.0: 12
├─ BSD-3-Clause: 10
├─ BlueOak-1.0.0: 6
├─ BSD-2-Clause: 5
├─ (MIT OR Apache-2.0): 2
├─ (MIT OR CC0-1.0): 2
├─ MPL-2.0: 2
├─ Unlicense: 2
├─ (BSD-3-Clause OR GPL-2.0): 1
├─ 0BSD: 1
├─ CC-BY-4.0: 1
└─ Python-2.0: 1
```

The generator intersects lockfile entries without `dev: true` with installed license metadata:

```sh
npm ls --omit=dev --all
./node_modules/.bin/license-checker --json --excludePrivatePackages
```

| Package                                              | Version        | License                   | Repository                                                                                          |
| ---------------------------------------------------- | -------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| @babel/code-frame                                    | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/compat-data                                   | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/core                                          | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/generator                                     | 7.29.8         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-annotate-as-pure                       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-compilation-targets                    | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-create-class-features-plugin           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-create-regexp-features-plugin          | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-define-polyfill-provider               | 0.6.8          | MIT                       | https://github.com/babel/babel-polyfills                                                            |
| @babel/helper-globals                                | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-member-expression-to-functions         | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-module-imports                         | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-module-transforms                      | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-optimise-call-expression               | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-plugin-utils                           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-remap-async-to-generator               | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-replace-supers                         | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-skip-transparent-expression-wrappers   | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-string-parser                          | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-validator-identifier                   | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-validator-option                       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helper-wrap-function                          | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/helpers                                       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/parser                                        | 7.29.8         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-proposal-decorators                    | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-proposal-export-default-from           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-syntax-decorators                      | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-syntax-dynamic-import                  | 7.8.3          | MIT                       | https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-dynamic-import              |
| @babel/plugin-syntax-export-default-from             | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-syntax-flow                            | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-syntax-jsx                             | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-syntax-nullish-coalescing-operator     | 7.8.3          | MIT                       | https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-nullish-coalescing-operator |
| @babel/plugin-syntax-optional-chaining               | 7.8.3          | MIT                       | https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-optional-chaining           |
| @babel/plugin-syntax-typescript                      | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-async-generator-functions    | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-async-to-generator           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-block-scoping                | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-class-properties             | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-class-static-block           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-classes                      | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-destructuring                | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-export-namespace-from        | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-flow-strip-types             | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-for-of                       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-logical-assignment-operators | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-modules-commonjs             | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-named-capturing-groups-regex | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-nullish-coalescing-operator  | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-object-rest-spread           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-optional-catch-binding       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-optional-chaining            | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-parameters                   | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-private-methods              | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-private-property-in-object   | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-react-display-name           | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-react-jsx-development        | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-react-jsx                    | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-react-pure-annotations       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-runtime                      | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-typescript                   | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/plugin-transform-unicode-regex                | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/preset-typescript                             | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/runtime                                       | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/template                                      | 7.29.7         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/traverse                                      | 7.29.8         | MIT                       | https://github.com/babel/babel                                                                      |
| @babel/types                                         | 7.29.8         | MIT                       | https://github.com/babel/babel                                                                      |
| @expo/cli                                            | 57.0.17        | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/code-signing-certificates                      | 0.0.6          | MIT                       | https://github.com/expo/code-signing-certificates                                                   |
| @expo/config-plugins                                 | 57.0.8         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/config-types                                   | 57.0.2         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/config                                         | 57.0.8         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/devcert                                        | 1.2.1          | MIT                       | https://github.com/expo/devcert                                                                     |
| @expo/devtools                                       | 57.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/dom-webview                                    | 57.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/env                                            | 2.4.2          | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/expo-modules-macros-plugin                     | 0.6.1          | MIT                       | https://github.com/expo/expo-modules-macros-plugin                                                  |
| @expo/fingerprint                                    | 0.20.9         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/image-utils                                    | 0.11.4         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/inline-modules                                 | 0.1.6          | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/json-file                                      | 11.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/local-build-cache-provider                     | 57.0.7         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/log-box                                        | 57.0.3         | MIT                       | —                                                                                                   |
| @expo/metro-config                                   | 57.0.9         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/metro-file-map                                 | 57.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/metro                                          | 56.0.2         | MIT                       | https://github.com/expo/expo-metro                                                                  |
| @expo/osascript                                      | 2.7.1          | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/package-manager                                | 1.13.1         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/plist                                          | 0.8.1          | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/prebuild-config                                | 57.0.13        | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/require-utils                                  | 57.0.4         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/router-server                                  | 57.0.7         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/schema-utils                                   | 57.0.2         | MIT                       | https://github.com/expo/expo                                                                        |
| @expo/sdk-runtime-versions                           | 1.0.0          | MIT                       | —                                                                                                   |
| @expo/spawn-async                                    | 1.8.0          | MIT                       | https://github.com/expo/spawn-async                                                                 |
| @expo/sudo-prompt                                    | 9.3.2          | MIT                       | https://github.com/expo/sudo-prompt                                                                 |
| @expo/ws-tunnel                                      | 2.0.0          | MIT                       | —                                                                                                   |
| @expo/xcpretty                                       | 4.4.4          | BSD-3-Clause              | https://github.com/expo/expo-cli                                                                    |
| @isaacs/ttlcache                                     | 1.4.1          | ISC                       | https://github.com/isaacs/ttlcache                                                                  |
| @jest/schemas                                        | 29.6.3         | MIT                       | https://github.com/jestjs/jest                                                                      |
| @jest/types                                          | 29.6.3         | MIT                       | https://github.com/jestjs/jest                                                                      |
| @jridgewell/gen-mapping                              | 0.3.13         | MIT                       | https://github.com/jridgewell/sourcemaps                                                            |
| @jridgewell/remapping                                | 2.3.5          | MIT                       | https://github.com/jridgewell/sourcemaps                                                            |
| @jridgewell/resolve-uri                              | 3.1.2          | MIT                       | https://github.com/jridgewell/resolve-uri                                                           |
| @jridgewell/source-map                               | 0.3.11         | MIT                       | https://github.com/jridgewell/sourcemaps                                                            |
| @jridgewell/sourcemap-codec                          | 1.5.5          | MIT                       | https://github.com/jridgewell/sourcemaps                                                            |
| @jridgewell/trace-mapping                            | 0.3.31         | MIT                       | https://github.com/jridgewell/sourcemaps                                                            |
| @mapbox/jsonlint-lines-primitives                    | 2.0.3          | MIT                       | https://github.com/mapbox/jsonlint                                                                  |
| @mapbox/point-geometry                               | 1.1.0          | ISC                       | https://github.com/mapbox/point-geometry                                                            |
| @mapbox/tiny-sdf                                     | 2.2.0          | BSD-2-Clause              | https://github.com/mapbox/tiny-sdf                                                                  |
| @mapbox/unitbezier                                   | 1.0.0          | BSD-2-Clause              | https://github.com/mapbox/unitbezier                                                                |
| @mapbox/vector-tile                                  | 3.0.0          | BSD-3-Clause              | https://github.com/mapbox/vector-tile-js                                                            |
| @maplibre/geojson-vt                                 | 6.1.1          | ISC                       | https://github.com/maplibre/geojson-vt                                                              |
| @maplibre/maplibre-gl-style-spec                     | 26.2.1         | ISC                       | https://github.com/maplibre/maplibre-style-spec                                                     |
| @maplibre/mlt                                        | 1.1.12         | (MIT OR Apache-2.0)       | https://github.com/maplibre/maplibre-tile-spec                                                      |
| @maplibre/vt-pbf                                     | 4.3.2          | MIT                       | https://github.com/maplibre/vt-pbf                                                                  |
| @react-native-community/slider                       | 5.2.0          | MIT                       | https://github.com/callstack/react-native-slider                                                    |
| @react-native/assets-registry                        | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/babel-plugin-codegen                   | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/codegen                                | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/community-cli-plugin                   | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/debugger-frontend                      | 0.86.2         | BSD-3-Clause              | https://github.com/react/react-native                                                               |
| @react-native/debugger-shell                         | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/dev-middleware                         | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/gradle-plugin                          | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/js-polyfills                           | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/normalize-colors                       | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @react-native/virtualized-lists                      | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| @sinclair/typebox                                    | 0.27.12        | MIT                       | https://github.com/sinclairzx81/sinclair-typebox                                                    |
| @types/geojson                                       | 7946.0.16      | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/istanbul-lib-coverage                         | 2.0.6          | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/istanbul-lib-report                           | 3.0.3          | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/istanbul-reports                              | 3.0.4          | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/node                                          | 26.2.0         | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/react                                         | 19.2.18        | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/yargs-parser                                  | 21.0.3         | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @types/yargs                                         | 17.0.35        | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped                                                  |
| @ungap/structured-clone                              | 1.3.3          | ISC                       | https://github.com/ungap/structured-clone                                                           |
| @xmldom/xmldom                                       | 0.8.15         | MIT                       | https://github.com/xmldom/xmldom                                                                    |
| @xmldom/xmldom                                       | 0.9.12         | MIT                       | https://github.com/xmldom/xmldom                                                                    |
| abort-controller                                     | 3.0.0          | MIT                       | https://github.com/mysticatea/abort-controller                                                      |
| accepts                                              | 1.3.8          | MIT                       | https://github.com/jshttp/accepts                                                                   |
| accepts                                              | 2.0.0          | MIT                       | https://github.com/jshttp/accepts                                                                   |
| acorn                                                | 8.17.0         | MIT                       | https://github.com/acornjs/acorn                                                                    |
| agent-base                                           | 7.1.4          | MIT                       | https://github.com/TooTallNate/proxy-agents                                                         |
| agent-cli-detector                                   | 0.1.6          | MIT                       | https://github.com/expo/agent-cli-detector                                                          |
| anser                                                | 1.4.10         | MIT                       | https://github.com/IonicaBizau/anser                                                                |
| ansi-escapes                                         | 4.3.2          | MIT                       | https://github.com/sindresorhus/ansi-escapes                                                        |
| ansi-regex                                           | 4.1.1          | MIT                       | https://github.com/chalk/ansi-regex                                                                 |
| ansi-regex                                           | 5.0.1          | MIT                       | https://github.com/chalk/ansi-regex                                                                 |
| ansi-styles                                          | 3.2.1          | MIT                       | https://github.com/chalk/ansi-styles                                                                |
| ansi-styles                                          | 4.3.0          | MIT                       | https://github.com/chalk/ansi-styles                                                                |
| ansi-styles                                          | 5.2.0          | MIT                       | https://github.com/chalk/ansi-styles                                                                |
| arg                                                  | 5.0.2          | MIT                       | https://github.com/vercel/arg                                                                       |
| argparse                                             | 2.0.1          | Python-2.0                | https://github.com/nodeca/argparse                                                                  |
| asap                                                 | 2.0.6          | MIT                       | https://github.com/kriskowal/asap                                                                   |
| babel-plugin-polyfill-corejs2                        | 0.4.17         | MIT                       | https://github.com/babel/babel-polyfills                                                            |
| babel-plugin-polyfill-corejs3                        | 0.13.0         | MIT                       | https://github.com/babel/babel-polyfills                                                            |
| babel-plugin-polyfill-regenerator                    | 0.6.8          | MIT                       | https://github.com/babel/babel-polyfills                                                            |
| babel-plugin-react-compiler                          | 1.0.0          | MIT                       | https://github.com/facebook/react                                                                   |
| babel-plugin-react-native-web                        | 0.21.2         | MIT                       | https://github.com/necolas/react-native-web                                                         |
| babel-plugin-syntax-hermes-parser                    | 0.36.0         | MIT                       | https://github.com/facebook/hermes                                                                  |
| babel-plugin-syntax-hermes-parser                    | 0.36.1         | MIT                       | https://github.com/facebook/hermes                                                                  |
| babel-plugin-transform-flow-enums                    | 0.0.2          | MIT                       | https://github.com/facebook/flow                                                                    |
| babel-preset-expo                                    | 57.0.7         | MIT                       | https://github.com/expo/expo                                                                        |
| balanced-match                                       | 4.0.4          | MIT                       | https://github.com/juliangruber/balanced-match                                                      |
| base64-js                                            | 1.5.1          | MIT                       | https://github.com/beatgammit/base64-js                                                             |
| baseline-browser-mapping                             | 2.11.18        | Apache-2.0                | https://github.com/web-platform-dx/baseline-browser-mapping                                         |
| big-integer                                          | 1.6.52         | Unlicense                 | https://github.com/peterolson/BigInteger.js                                                         |
| bplist-creator                                       | 0.1.0          | MIT                       | https://github.com/nearinfinity/node-bplist-creator                                                 |
| bplist-parser                                        | 0.3.1          | MIT                       | https://github.com/nearinfinity/node-bplist-parser                                                  |
| bplist-parser                                        | 0.3.2          | MIT                       | https://github.com/nearinfinity/node-bplist-parser                                                  |
| brace-expansion                                      | 5.0.9          | MIT                       | https://github.com/juliangruber/brace-expansion                                                     |
| braces                                               | 3.0.3          | MIT                       | https://github.com/micromatch/braces                                                                |
| browserslist                                         | 4.28.8         | MIT                       | https://github.com/browserslist/browserslist                                                        |
| bser                                                 | 2.1.1          | Apache-2.0                | https://github.com/facebook/watchman                                                                |
| buffer-from                                          | 1.1.2          | MIT                       | https://github.com/LinusU/buffer-from                                                               |
| bytes                                                | 3.1.2          | MIT                       | https://github.com/visionmedia/bytes.js                                                             |
| camelcase                                            | 6.3.0          | MIT                       | https://github.com/sindresorhus/camelcase                                                           |
| caniuse-lite                                         | 1.0.30001809   | CC-BY-4.0                 | https://github.com/browserslist/caniuse-lite                                                        |
| chalk                                                | 2.4.2          | MIT                       | https://github.com/chalk/chalk                                                                      |
| chalk                                                | 4.1.2          | MIT                       | https://github.com/chalk/chalk                                                                      |
| chrome-launcher                                      | 0.15.2         | Apache-2.0                | https://github.com/GoogleChrome/chrome-launcher                                                     |
| chromium-edge-launcher                               | 0.3.0          | Apache-2.0                | https://github.com/cezaraugusto/chromium-edge-launcher                                              |
| ci-info                                              | 2.0.0          | MIT                       | https://github.com/watson/ci-info                                                                   |
| ci-info                                              | 3.9.0          | MIT                       | https://github.com/watson/ci-info                                                                   |
| cli-cursor                                           | 2.1.0          | MIT                       | https://github.com/sindresorhus/cli-cursor                                                          |
| cli-spinners                                         | 2.9.2          | MIT                       | https://github.com/sindresorhus/cli-spinners                                                        |
| cliui                                                | 8.0.1          | ISC                       | https://github.com/yargs/cliui                                                                      |
| clone                                                | 1.0.4          | MIT                       | https://github.com/pvorb/node-clone                                                                 |
| color-convert                                        | 1.9.3          | MIT                       | https://github.com/Qix-/color-convert                                                               |
| color-convert                                        | 2.0.1          | MIT                       | https://github.com/Qix-/color-convert                                                               |
| color-name                                           | 1.1.3          | MIT                       | https://github.com/dfcreative/color-name                                                            |
| color-name                                           | 1.1.4          | MIT                       | https://github.com/colorjs/color-name                                                               |
| commander                                            | 12.1.0         | MIT                       | https://github.com/tj/commander.js                                                                  |
| commander                                            | 2.20.3         | MIT                       | https://github.com/tj/commander.js                                                                  |
| commander                                            | 7.2.0          | MIT                       | https://github.com/tj/commander.js                                                                  |
| compressible                                         | 2.0.18         | MIT                       | https://github.com/jshttp/compressible                                                              |
| compression                                          | 1.8.1          | MIT                       | https://github.com/expressjs/compression                                                            |
| connect                                              | 3.7.0          | MIT                       | https://github.com/senchalabs/connect                                                               |
| content-type                                         | 2.1.0          | MIT                       | https://github.com/jshttp/content-type                                                              |
| convert-source-map                                   | 2.0.0          | MIT                       | https://github.com/thlorenz/convert-source-map                                                      |
| core-js-compat                                       | 3.50.0         | MIT                       | https://github.com/zloirock/core-js                                                                 |
| cross-spawn                                          | 7.0.6          | MIT                       | https://github.com/moxystudio/node-cross-spawn                                                      |
| csstype                                              | 3.2.3          | MIT                       | https://github.com/frenic/csstype                                                                   |
| debug                                                | 2.6.9          | MIT                       | https://github.com/visionmedia/debug                                                                |
| debug                                                | 3.2.7          | MIT                       | https://github.com/visionmedia/debug                                                                |
| debug                                                | 4.4.3          | MIT                       | https://github.com/debug-js/debug                                                                   |
| deepmerge                                            | 4.3.1          | MIT                       | https://github.com/TehShrike/deepmerge                                                              |
| defaults                                             | 1.0.4          | MIT                       | https://github.com/sindresorhus/node-defaults                                                       |
| depd                                                 | 2.0.0          | MIT                       | https://github.com/dougwilson/nodejs-depd                                                           |
| destroy                                              | 1.2.0          | MIT                       | https://github.com/stream-utils/destroy                                                             |
| detect-libc                                          | 2.1.2          | Apache-2.0                | https://github.com/lovell/detect-libc                                                               |
| dnssd-advertise                                      | 1.1.6          | MIT                       | https://github.com/kitten/dnssd-advertise                                                           |
| earcut                                               | 3.2.3          | ISC                       | https://github.com/mapbox/earcut                                                                    |
| ee-first                                             | 1.1.1          | MIT                       | https://github.com/jonathanong/ee-first                                                             |
| electron-to-chromium                                 | 1.5.412        | ISC                       | https://github.com/Kilian/electron-to-chromium                                                      |
| emoji-regex                                          | 8.0.0          | MIT                       | https://github.com/mathiasbynens/emoji-regex                                                        |
| encodeurl                                            | 1.0.2          | MIT                       | https://github.com/pillarjs/encodeurl                                                               |
| encodeurl                                            | 2.0.0          | MIT                       | https://github.com/pillarjs/encodeurl                                                               |
| error-stack-parser                                   | 2.1.4          | MIT                       | https://github.com/stacktracejs/error-stack-parser                                                  |
| es-errors                                            | 1.3.0          | MIT                       | https://github.com/ljharb/es-errors                                                                 |
| escalade                                             | 3.2.0          | MIT                       | https://github.com/lukeed/escalade                                                                  |
| escape-html                                          | 1.0.3          | MIT                       | https://github.com/component/escape-html                                                            |
| escape-string-regexp                                 | 1.0.5          | MIT                       | https://github.com/sindresorhus/escape-string-regexp                                                |
| escape-string-regexp                                 | 4.0.0          | MIT                       | https://github.com/sindresorhus/escape-string-regexp                                                |
| etag                                                 | 1.8.1          | MIT                       | https://github.com/jshttp/etag                                                                      |
| event-target-shim                                    | 5.0.1          | MIT                       | https://github.com/mysticatea/event-target-shim                                                     |
| expo-asset                                           | 57.0.13        | MIT                       | https://github.com/expo/expo                                                                        |
| expo-constants                                       | 57.0.13        | MIT                       | https://github.com/expo/expo                                                                        |
| expo-file-system                                     | 57.0.5         | MIT                       | https://github.com/expo/expo                                                                        |
| expo-font                                            | 57.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| expo-keep-awake                                      | 57.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| expo-location                                        | 57.0.12        | MIT                       | https://github.com/expo/expo                                                                        |
| expo-modules-autolinking                             | 57.0.10        | MIT                       | https://github.com/expo/expo                                                                        |
| expo-modules-core                                    | 57.0.12        | MIT                       | https://github.com/expo/expo                                                                        |
| expo-modules-jsi                                     | 57.0.5         | MIT                       | https://github.com/expo/expo                                                                        |
| expo-server                                          | 57.0.3         | MIT                       | https://github.com/expo/expo                                                                        |
| expo-status-bar                                      | 57.0.1         | MIT                       | https://github.com/expo/expo                                                                        |
| expo                                                 | 57.0.15        | MIT                       | https://github.com/expo/expo                                                                        |
| exponential-backoff                                  | 3.1.3          | Apache-2.0                | https://github.com/coveooss/exponential-backoff                                                     |
| fb-dotslash                                          | 0.5.8          | (MIT OR Apache-2.0)       | https://github.com/facebook/dotslash                                                                |
| fb-watchman                                          | 2.0.2          | Apache-2.0                | https://github.com/facebook/watchman                                                                |
| fdir                                                 | 6.5.0          | MIT                       | https://github.com/thecodrr/fdir                                                                    |
| fetch-nodeshim                                       | 0.4.10         | MIT                       | https://github.com/kitten/fetch-nodeshim                                                            |
| fill-range                                           | 7.1.1          | MIT                       | https://github.com/jonschlinkert/fill-range                                                         |
| finalhandler                                         | 1.1.2          | MIT                       | https://github.com/pillarjs/finalhandler                                                            |
| flow-enums-runtime                                   | 0.0.6          | MIT                       | https://github.com/facebook/flow                                                                    |
| fontfaceobserver                                     | 2.3.0          | BSD-2-Clause              | https://github.com/bramstein/fontfaceobserver                                                       |
| fresh                                                | 0.5.2          | MIT                       | https://github.com/jshttp/fresh                                                                     |
| function-bind                                        | 1.1.2          | MIT                       | https://github.com/Raynos/function-bind                                                             |
| gensync                                              | 1.0.0-beta.2   | MIT                       | https://github.com/loganfsmyth/gensync                                                              |
| get-caller-file                                      | 2.0.5          | ISC                       | https://github.com/stefanpenner/get-caller-file                                                     |
| getenv                                               | 2.0.0          | MIT                       | https://github.com/ctavan/node-getenv                                                               |
| gl-matrix                                            | 3.4.4          | MIT                       | https://github.com/toji/gl-matrix                                                                   |
| glob                                                 | 13.0.6         | BlueOak-1.0.0             | https://github.com/isaacs/node-glob                                                                 |
| graceful-fs                                          | 4.2.11         | ISC                       | https://github.com/isaacs/node-graceful-fs                                                          |
| has-flag                                             | 3.0.0          | MIT                       | https://github.com/sindresorhus/has-flag                                                            |
| has-flag                                             | 4.0.0          | MIT                       | https://github.com/sindresorhus/has-flag                                                            |
| hasown                                               | 2.0.4          | MIT                       | https://github.com/inspect-js/hasOwn                                                                |
| hermes-compiler                                      | 250829098.0.16 | MIT                       | https://github.com/facebook/hermes                                                                  |
| hermes-estree                                        | 0.35.0         | MIT                       | https://github.com/facebook/hermes                                                                  |
| hermes-estree                                        | 0.36.0         | MIT                       | https://github.com/facebook/hermes                                                                  |
| hermes-estree                                        | 0.36.1         | MIT                       | https://github.com/facebook/hermes                                                                  |
| hermes-parser                                        | 0.35.0         | MIT                       | https://github.com/facebook/hermes                                                                  |
| hermes-parser                                        | 0.36.0         | MIT                       | https://github.com/facebook/hermes                                                                  |
| hermes-parser                                        | 0.36.1         | MIT                       | https://github.com/facebook/hermes                                                                  |
| hosted-git-info                                      | 7.0.2          | ISC                       | https://github.com/npm/hosted-git-info                                                              |
| http-errors                                          | 2.0.1          | MIT                       | https://github.com/jshttp/http-errors                                                               |
| https-proxy-agent                                    | 7.0.6          | MIT                       | https://github.com/TooTallNate/proxy-agents                                                         |
| ignore                                               | 5.3.2          | MIT                       | https://github.com/kaelzhang/node-ignore                                                            |
| inherits                                             | 2.0.4          | ISC                       | https://github.com/isaacs/inherits                                                                  |
| invariant                                            | 2.2.4          | MIT                       | https://github.com/zertosh/invariant                                                                |
| is-core-module                                       | 2.16.2         | MIT                       | https://github.com/inspect-js/is-core-module                                                        |
| is-docker                                            | 2.2.1          | MIT                       | https://github.com/sindresorhus/is-docker                                                           |
| is-fullwidth-code-point                              | 3.0.0          | MIT                       | https://github.com/sindresorhus/is-fullwidth-code-point                                             |
| is-number                                            | 7.0.0          | MIT                       | https://github.com/jonschlinkert/is-number                                                          |
| is-wsl                                               | 2.2.0          | MIT                       | https://github.com/sindresorhus/is-wsl                                                              |
| isexe                                                | 2.0.0          | ISC                       | https://github.com/isaacs/isexe                                                                     |
| jest-get-type                                        | 29.6.3         | MIT                       | https://github.com/jestjs/jest                                                                      |
| jest-util                                            | 29.7.0         | MIT                       | https://github.com/jestjs/jest                                                                      |
| jest-validate                                        | 29.7.0         | MIT                       | https://github.com/jestjs/jest                                                                      |
| jest-worker                                          | 29.7.0         | MIT                       | https://github.com/jestjs/jest                                                                      |
| jimp-compact                                         | 0.16.1         | MIT                       | https://github.com/nuxt-community/jimp-compact                                                      |
| js-tokens                                            | 4.0.0          | MIT                       | https://github.com/lydell/js-tokens                                                                 |
| js-yaml                                              | 4.3.1          | MIT                       | https://github.com/nodeca/js-yaml                                                                   |
| jsc-safe-url                                         | 0.2.4          | 0BSD                      | https://github.com/robhogan/jsc-safe-url                                                            |
| jsesc                                                | 3.1.0          | MIT                       | https://github.com/mathiasbynens/jsesc                                                              |
| json-stringify-pretty-compact                        | 4.0.0          | MIT                       | https://github.com/lydell/json-stringify-pretty-compact                                             |
| json5                                                | 2.2.3          | MIT                       | https://github.com/json5/json5                                                                      |
| kdbush                                               | 4.1.0          | ISC                       | https://github.com/mourner/kdbush                                                                   |
| kleur                                                | 3.0.3          | MIT                       | https://github.com/lukeed/kleur                                                                     |
| lan-network                                          | 0.2.1          | MIT                       | https://github.com/kitten/lan-network                                                               |
| leven                                                | 3.1.0          | MIT                       | https://github.com/sindresorhus/leven                                                               |
| lighthouse-logger                                    | 1.2.0          | Apache-2.0                | —                                                                                                   |
| lightningcss-darwin-arm64                            | 1.33.0         | MPL-2.0                   | https://github.com/parcel-bundler/lightningcss                                                      |
| lightningcss                                         | 1.33.0         | MPL-2.0                   | https://github.com/parcel-bundler/lightningcss                                                      |
| lodash.debounce                                      | 4.0.8          | MIT                       | https://github.com/lodash/lodash                                                                    |
| lodash.throttle                                      | 4.1.1          | MIT                       | https://github.com/lodash/lodash                                                                    |
| log-symbols                                          | 2.2.0          | MIT                       | https://github.com/sindresorhus/log-symbols                                                         |
| loose-envify                                         | 1.4.0          | MIT                       | https://github.com/zertosh/loose-envify                                                             |
| lru-cache                                            | 10.4.3         | ISC                       | https://github.com/isaacs/node-lru-cache                                                            |
| lru-cache                                            | 11.5.2         | BlueOak-1.0.0             | https://github.com/isaacs/node-lru-cache                                                            |
| lru-cache                                            | 5.1.1          | ISC                       | https://github.com/isaacs/node-lru-cache                                                            |
| makeerror                                            | 1.0.12         | BSD-3-Clause              | https://github.com/daaku/nodejs-makeerror                                                           |
| maplibre-gl                                          | 6.3.0          | BSD-3-Clause              | https://github.com/maplibre/maplibre-gl-js                                                          |
| marky                                                | 1.3.0          | Apache-2.0                | https://github.com/nolanlawson/marky                                                                |
| memoize-one                                          | 5.2.1          | MIT                       | https://github.com/alexreardon/memoize-one                                                          |
| merge-stream                                         | 2.0.0          | MIT                       | https://github.com/grncdr/merge-stream                                                              |
| metro-babel-transformer                              | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-cache-key                                      | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-cache                                          | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-config                                         | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-core                                           | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-file-map                                       | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-minify-terser                                  | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-resolver                                       | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-runtime                                        | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-source-map                                     | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-symbolicate                                    | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-transform-plugins                              | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro-transform-worker                               | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| metro                                                | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| micromatch                                           | 4.0.8          | MIT                       | https://github.com/micromatch/micromatch                                                            |
| mime-db                                              | 1.52.0         | MIT                       | https://github.com/jshttp/mime-db                                                                   |
| mime-db                                              | 1.54.0         | MIT                       | https://github.com/jshttp/mime-db                                                                   |
| mime-types                                           | 2.1.35         | MIT                       | https://github.com/jshttp/mime-types                                                                |
| mime-types                                           | 3.0.2          | MIT                       | https://github.com/jshttp/mime-types                                                                |
| mime                                                 | 1.6.0          | MIT                       | https://github.com/broofa/node-mime                                                                 |
| mimic-fn                                             | 1.2.0          | MIT                       | https://github.com/sindresorhus/mimic-fn                                                            |
| minimatch                                            | 10.2.5         | BlueOak-1.0.0             | https://github.com/isaacs/minimatch                                                                 |
| minimist                                             | 1.2.8          | MIT                       | https://github.com/minimistjs/minimist                                                              |
| minipass                                             | 7.1.3          | BlueOak-1.0.0             | https://github.com/isaacs/minipass                                                                  |
| mkdirp                                               | 1.0.4          | MIT                       | https://github.com/isaacs/node-mkdirp                                                               |
| ms                                                   | 2.0.0          | MIT                       | https://github.com/zeit/ms                                                                          |
| ms                                                   | 2.1.3          | MIT                       | https://github.com/vercel/ms                                                                        |
| multitars                                            | 1.0.2          | MIT                       | https://github.com/expo/multitars                                                                   |
| murmurhash-js                                        | 1.0.0          | MIT                       | https://github.com/mikolalysenko/murmurhash-js                                                      |
| nanoid                                               | 3.3.18         | MIT                       | https://github.com/ai/nanoid                                                                        |
| negotiator                                           | 0.6.3          | MIT                       | https://github.com/jshttp/negotiator                                                                |
| negotiator                                           | 0.6.4          | MIT                       | https://github.com/jshttp/negotiator                                                                |
| negotiator                                           | 1.1.0          | MIT                       | https://github.com/jshttp/negotiator                                                                |
| node-forge                                           | 1.4.0          | (BSD-3-Clause OR GPL-2.0) | https://github.com/digitalbazaar/forge                                                              |
| node-int64                                           | 0.4.0          | MIT                       | https://github.com/broofa/node-int64                                                                |
| node-releases                                        | 2.0.53         | MIT                       | https://github.com/chicoxyzzy/node-releases                                                         |
| npm-package-arg                                      | 11.0.3         | ISC                       | https://github.com/npm/npm-package-arg                                                              |
| nullthrows                                           | 1.1.1          | MIT                       | https://github.com/zertosh/nullthrows                                                               |
| ob1                                                  | 0.84.5         | MIT                       | https://github.com/react/metro                                                                      |
| on-finished                                          | 2.3.0          | MIT                       | https://github.com/jshttp/on-finished                                                               |
| on-finished                                          | 2.4.1          | MIT                       | https://github.com/jshttp/on-finished                                                               |
| on-headers                                           | 1.1.0          | MIT                       | https://github.com/jshttp/on-headers                                                                |
| onetime                                              | 2.0.1          | MIT                       | https://github.com/sindresorhus/onetime                                                             |
| open                                                 | 7.4.2          | MIT                       | https://github.com/sindresorhus/open                                                                |
| ora                                                  | 3.4.0          | MIT                       | https://github.com/sindresorhus/ora                                                                 |
| parse-png                                            | 2.1.0          | MIT                       | https://github.com/kevva/parse-png                                                                  |
| parseurl                                             | 1.3.3          | MIT                       | https://github.com/pillarjs/parseurl                                                                |
| path-key                                             | 3.1.1          | MIT                       | https://github.com/sindresorhus/path-key                                                            |
| path-parse                                           | 1.0.7          | MIT                       | https://github.com/jbgutierrez/path-parse                                                           |
| path-scurry                                          | 2.0.2          | BlueOak-1.0.0             | https://github.com/isaacs/path-scurry                                                               |
| pbf                                                  | 5.1.2          | BSD-3-Clause              | https://github.com/mapbox/pbf                                                                       |
| picocolors                                           | 1.1.1          | ISC                       | https://github.com/alexeyraspopov/picocolors                                                        |
| picomatch                                            | 2.3.2          | MIT                       | https://github.com/micromatch/picomatch                                                             |
| picomatch                                            | 4.0.5          | MIT                       | https://github.com/micromatch/picomatch                                                             |
| plist                                                | 3.1.1          | MIT                       | https://github.com/TooTallNate/node-plist                                                           |
| pngjs                                                | 3.4.0          | MIT                       | https://github.com/lukeapage/pngjs2                                                                 |
| postcss                                              | 8.5.26         | MIT                       | https://github.com/postcss/postcss                                                                  |
| potpack                                              | 2.1.0          | ISC                       | https://github.com/mapbox/potpack                                                                   |
| pretty-format                                        | 29.7.0         | MIT                       | https://github.com/jestjs/jest                                                                      |
| proc-log                                             | 4.2.0          | ISC                       | https://github.com/npm/proc-log                                                                     |
| progress                                             | 2.0.3          | MIT                       | https://github.com/visionmedia/node-progress                                                        |
| promise                                              | 8.3.0          | MIT                       | https://github.com/then/promise                                                                     |
| prompts                                              | 2.4.2          | MIT                       | https://github.com/terkelg/prompts                                                                  |
| protocol-buffers-schema                              | 3.6.1          | MIT                       | https://github.com/mafintosh/protocol-buffers-schema                                                |
| quickselect                                          | 3.0.0          | ISC                       | https://github.com/mourner/quickselect                                                              |
| range-parser                                         | 1.2.1          | MIT                       | https://github.com/jshttp/range-parser                                                              |
| react-devtools-core                                  | 6.1.5          | MIT                       | https://github.com/facebook/react                                                                   |
| react-is                                             | 18.3.1         | MIT                       | https://github.com/facebook/react                                                                   |
| react-native-maps                                    | 1.27.2         | MIT                       | https://github.com/react-native-maps/react-native-maps                                              |
| react-native-safe-area-context                       | 5.7.0          | MIT                       | https://github.com/AppAndFlow/react-native-safe-area-context                                        |
| react-native                                         | 0.86.2         | MIT                       | https://github.com/react/react-native                                                               |
| react-refresh                                        | 0.14.2         | MIT                       | https://github.com/facebook/react                                                                   |
| react                                                | 19.2.3         | MIT                       | https://github.com/facebook/react                                                                   |
| regenerate-unicode-properties                        | 10.2.2         | MIT                       | https://github.com/mathiasbynens/regenerate-unicode-properties                                      |
| regenerate                                           | 1.4.2          | MIT                       | https://github.com/mathiasbynens/regenerate                                                         |
| regenerator-runtime                                  | 0.13.11        | MIT                       | https://github.com/facebook/regenerator/tree/main/packages/runtime                                  |
| regexpu-core                                         | 6.4.0          | MIT                       | https://github.com/mathiasbynens/regexpu-core                                                       |
| regjsgen                                             | 0.8.0          | MIT                       | https://github.com/bnjmnt4n/regjsgen                                                                |
| regjsparser                                          | 0.13.2         | BSD-2-Clause              | https://github.com/jviereck/regjsparser                                                             |
| require-directory                                    | 2.1.1          | MIT                       | https://github.com/troygoode/node-require-directory                                                 |
| resolve-from                                         | 5.0.0          | MIT                       | https://github.com/sindresorhus/resolve-from                                                        |
| resolve-protobuf-schema                              | 2.1.0          | MIT                       | https://github.com/mafintosh/resolve-protobuf-schema                                                |
| resolve-workspace-root                               | 2.0.1          | MIT                       | https://github.com/byCedric/resolve-workspace-root                                                  |
| resolve                                              | 1.22.12        | MIT                       | https://github.com/browserify/resolve                                                               |
| restore-cursor                                       | 2.0.0          | MIT                       | https://github.com/sindresorhus/restore-cursor                                                      |
| safe-buffer                                          | 5.2.1          | MIT                       | https://github.com/feross/safe-buffer                                                               |
| sandbox-cli-detector                                 | 0.2.0          | MIT                       | https://github.com/davidmokos/sandbox-cli-detector                                                  |
| sax                                                  | 1.6.1          | BlueOak-1.0.0             | https://github.com/isaacs/sax-js                                                                    |
| scheduler                                            | 0.27.0         | MIT                       | https://github.com/facebook/react                                                                   |
| semver                                               | 6.3.1          | ISC                       | https://github.com/npm/node-semver                                                                  |
| semver                                               | 7.8.5          | ISC                       | https://github.com/npm/node-semver                                                                  |
| send                                                 | 0.19.2         | MIT                       | https://github.com/pillarjs/send                                                                    |
| serialize-error                                      | 2.1.0          | MIT                       | https://github.com/sindresorhus/serialize-error                                                     |
| serve-static                                         | 1.16.3         | MIT                       | https://github.com/expressjs/serve-static                                                           |
| setprototypeof                                       | 1.2.0          | ISC                       | https://github.com/wesleytodd/setprototypeof                                                        |
| shebang-command                                      | 2.0.0          | MIT                       | https://github.com/kevva/shebang-command                                                            |
| shebang-regex                                        | 3.0.0          | MIT                       | https://github.com/sindresorhus/shebang-regex                                                       |
| shell-quote                                          | 1.10.0         | MIT                       | https://github.com/ljharb/shell-quote                                                               |
| signal-exit                                          | 3.0.7          | ISC                       | https://github.com/tapjs/signal-exit                                                                |
| simple-plist                                         | 1.3.1          | MIT                       | https://github.com/wollardj/simple-plist                                                            |
| sisteransi                                           | 1.0.5          | MIT                       | https://github.com/terkelg/sisteransi                                                               |
| slugify                                              | 1.6.9          | MIT                       | https://github.com/simov/slugify                                                                    |
| source-map-js                                        | 1.2.1          | BSD-3-Clause              | https://github.com/7rulnik/source-map-js                                                            |
| source-map-support                                   | 0.5.21         | MIT                       | https://github.com/evanw/node-source-map-support                                                    |
| source-map                                           | 0.5.7          | BSD-3-Clause              | https://github.com/mozilla/source-map                                                               |
| source-map                                           | 0.6.1          | BSD-3-Clause              | https://github.com/mozilla/source-map                                                               |
| stackframe                                           | 1.3.4          | MIT                       | https://github.com/stacktracejs/stackframe                                                          |
| stacktrace-parser                                    | 0.1.11         | MIT                       | https://github.com/errwischt/stacktrace-parser                                                      |
| statuses                                             | 1.5.0          | MIT                       | https://github.com/jshttp/statuses                                                                  |
| statuses                                             | 2.0.2          | MIT                       | https://github.com/jshttp/statuses                                                                  |
| stream-buffers                                       | 2.2.0          | Unlicense                 | https://github.com/samcday/node-stream-buffer                                                       |
| string-width                                         | 4.2.3          | MIT                       | https://github.com/sindresorhus/string-width                                                        |
| strip-ansi                                           | 5.2.0          | MIT                       | https://github.com/chalk/strip-ansi                                                                 |
| strip-ansi                                           | 6.0.1          | MIT                       | https://github.com/chalk/strip-ansi                                                                 |
| structured-headers                                   | 0.4.1          | MIT                       | https://github.com/evert/structured-header                                                          |
| supports-color                                       | 5.5.0          | MIT                       | https://github.com/chalk/supports-color                                                             |
| supports-color                                       | 7.2.0          | MIT                       | https://github.com/chalk/supports-color                                                             |
| supports-color                                       | 8.1.1          | MIT                       | https://github.com/chalk/supports-color                                                             |
| supports-hyperlinks                                  | 2.3.0          | MIT                       | https://github.com/jamestalmage/supports-hyperlinks                                                 |
| supports-preserve-symlinks-flag                      | 1.0.0          | MIT                       | https://github.com/inspect-js/node-supports-preserve-symlinks-flag                                  |
| terminal-link                                        | 2.1.1          | MIT                       | https://github.com/sindresorhus/terminal-link                                                       |
| terser                                               | 5.50.0         | BSD-2-Clause              | https://github.com/terser/terser                                                                    |
| throat                                               | 5.0.0          | MIT                       | https://github.com/ForbesLindesay/throat                                                            |
| tinyglobby                                           | 0.2.17         | MIT                       | https://github.com/SuperchupuDev/tinyglobby                                                         |
| tinyqueue                                            | 3.0.0          | ISC                       | https://github.com/mourner/tinyqueue                                                                |
| tmpl                                                 | 1.0.5          | BSD-3-Clause              | https://github.com/daaku/nodejs-tmpl                                                                |
| to-regex-range                                       | 5.0.1          | MIT                       | https://github.com/micromatch/to-regex-range                                                        |
| toidentifier                                         | 1.0.1          | MIT                       | https://github.com/component/toidentifier                                                           |
| toqr                                                 | 0.1.1          | MIT                       | https://github.com/kitten/toqr                                                                      |
| type-fest                                            | 0.21.3         | (MIT OR CC0-1.0)          | https://github.com/sindresorhus/type-fest                                                           |
| type-fest                                            | 0.7.1          | (MIT OR CC0-1.0)          | https://github.com/sindresorhus/type-fest                                                           |
| typescript                                           | 5.9.3          | Apache-2.0                | https://github.com/microsoft/TypeScript                                                             |
| undici-types                                         | 8.3.0          | MIT                       | https://github.com/nodejs/undici                                                                    |
| unicode-canonical-property-names-ecmascript          | 2.0.1          | MIT                       | https://github.com/mathiasbynens/unicode-canonical-property-names-ecmascript                        |
| unicode-match-property-ecmascript                    | 2.0.0          | MIT                       | https://github.com/mathiasbynens/unicode-match-property-ecmascript                                  |
| unicode-match-property-value-ecmascript              | 2.2.1          | MIT                       | https://github.com/mathiasbynens/unicode-match-property-value-ecmascript                            |
| unicode-property-aliases-ecmascript                  | 2.2.0          | MIT                       | https://github.com/mathiasbynens/unicode-property-aliases-ecmascript                                |
| unpipe                                               | 1.0.0          | MIT                       | https://github.com/stream-utils/unpipe                                                              |
| update-browserslist-db                               | 1.3.1          | MIT                       | https://github.com/browserslist/update-db                                                           |
| utils-merge                                          | 1.0.1          | MIT                       | https://github.com/jaredhanson/utils-merge                                                          |
| uuid                                                 | 7.0.3          | MIT                       | https://github.com/uuidjs/uuid                                                                      |
| validate-npm-package-name                            | 5.0.1          | ISC                       | https://github.com/npm/validate-npm-package-name                                                    |
| vary                                                 | 1.1.2          | MIT                       | https://github.com/jshttp/vary                                                                      |
| vlq                                                  | 1.0.1          | MIT                       | https://github.com/Rich-Harris/vlq                                                                  |
| walker                                               | 1.0.8          | Apache-2.0                | https://github.com/daaku/nodejs-walker                                                              |
| wcwidth                                              | 1.0.1          | MIT                       | https://github.com/timoxley/wcwidth                                                                 |
| whatwg-fetch                                         | 3.6.20         | MIT                       | https://github.com/github/fetch                                                                     |
| whatwg-url-minimum                                   | 0.1.2          | MIT                       | https://github.com/kitten/whatwg-url-minimum                                                        |
| which                                                | 2.0.2          | ISC                       | https://github.com/isaacs/node-which                                                                |
| wrap-ansi                                            | 7.0.0          | MIT                       | https://github.com/chalk/wrap-ansi                                                                  |
| ws                                                   | 7.5.13         | MIT                       | https://github.com/websockets/ws                                                                    |
| ws                                                   | 8.21.3         | MIT                       | https://github.com/websockets/ws                                                                    |
| xcode                                                | 3.0.1          | Apache-2.0                | https://github.com/apache/cordova-node-xcode                                                        |
| xml2js                                               | 0.6.0          | MIT                       | https://github.com/Leonidas-from-XIV/node-xml2js                                                    |
| xmlbuilder                                           | 11.0.1         | MIT                       | https://github.com/oozcitak/xmlbuilder-js                                                           |
| xmlbuilder                                           | 15.1.1         | MIT                       | https://github.com/oozcitak/xmlbuilder-js                                                           |
| y18n                                                 | 5.0.8          | ISC                       | https://github.com/yargs/y18n                                                                       |
| yallist                                              | 3.1.1          | ISC                       | https://github.com/isaacs/yallist                                                                   |
| yaml                                                 | 2.9.0          | ISC                       | https://github.com/eemeli/yaml                                                                      |
| yargs-parser                                         | 21.1.1         | ISC                       | https://github.com/yargs/yargs-parser                                                               |
| yargs                                                | 17.7.3         | MIT                       | https://github.com/yargs/yargs                                                                      |
| zod                                                  | 3.25.76        | MIT                       | https://github.com/colinhacks/zod                                                                   |

<!-- license-checker:production:end -->

## Data sources & required attributions

| Source                | Required on-screen credit  | Terms / source URL                                                   | Notes                                                                                                                                                                                |
| --------------------- | -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GSI tiles             | 地理院タイル（国土地理院） | https://maps.gsi.go.jp/development/ichiran.html                      | GSI tile use requires attribution. Some historical aerial photo layers may have per-layer source strings that must be copied into registry attribution at implementation time.       |
| Konjaku Map           | 今昔マップ on the web      | https://ktgis.net/kjmapw/tilemapservice.html                         | Public deployment is gated by ADR-006. Do not enable the Konjaku provider publicly until the owner records permission from Saitama University.                                       |
| Wikipedia / Wikimedia | Wikipedia text: CC BY-SA   | Source article URL + https://creativecommons.org/licenses/by-sa/4.0/ | Article extracts are credited to Wikipedia and must link back to the source article; Wikimedia API behavior and attribution are tracked in `docs/research/wikimedia-geodata-api.md`. |

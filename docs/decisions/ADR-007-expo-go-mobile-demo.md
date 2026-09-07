# ADR-007: Expo Go mobile demo alongside the Web PWA

Date: 2026-08-24 / Status: Accepted

## Context

Chronomap v1 is a mobile-first Web PWA built with MapLibre GL JS, TypeScript, and Vite. On
2026-08-24 the owner explicitly requested an additional mobile app that can be demonstrated on a
physical device with Expo Go. A WebView wrapper would reproduce the browser shell but would not
exercise native map, safe-area, location-permission, and touch-control behavior.

The mobile demo must not weaken the existing Web architecture or require signing credentials,
custom native modules, EAS Build, or a store release. Provider data and era-selection behavior must
remain consistent between clients.

The initial implementation selected SDK 57 as the newest stable SDK. Physical iPhone validation
then showed that the Apple App Store Expo Go client stops at SDK 54 and rejects the SDK 57 project.
The owner explicitly approved changing the demo to SDK 54 so the ordinary App Store client can open
the QR without a separately signed Expo Go build.

## Decision

- Add `apps/mobile` as an npm workspace using Expo SDK 54 and its bundled React Native version.
- Pin the SDK 54 peer runtime (`expo`, React, React Native, and TypeScript) at the repository root so
  npm resolves one native runtime across the workspace. Keep the root `expo` entry as a development
  alignment dependency; the mobile workspace remains the runtime owner.
- Override Expo's bundled Metro `0.83.3` suite to React Native 0.81.5's patch-compatible `0.83.8`
  suite and PostCSS to `8.5.26`. These versions remove the high-severity audit findings present in
  the older build-tool dependencies and must continue to pass Expo Doctor plus Android/iOS export.
- Keep the existing root Vite/PWA application as the Web production client. ADR-002 remains the
  Web renderer/UI decision and is not superseded.
- Build a native demo UI with `react-native-maps`, `expo-location`,
  `@react-native-community/slider`, and `react-native-safe-area-context`. Every dependency must be
  supported by the Expo Go binary for SDK 54.
- Reuse the root GSI registry, registry loader, layer resolver, and GSI basemap constants through
  the monorepo. Do not copy provider records or fork the resolution algorithm.
- Start the demo over central Tokyo in a historical year so its value is visible immediately. The
  user can pan/zoom, choose a year, reset to the present, adjust historical-overlay opacity, and
  request foreground location explicitly.
- Use GSI raster tiles only. Keep Konjaku disabled under ADR-006 and leave POI/share parity for a
  separately approved production-mobile scope.
- Request foreground location only after a user action. Do not persist coordinates, use background
  location, add analytics, or cache/prefetch map tiles.
- Treat Expo Go as the requested demonstration target. A production app binary is a separate gate
  requiring a development/store build review, native map configuration, credentials supplied by the
  owner, and a device/release matrix.

## Consequences

- A QR-driven iOS/Android demo can be run with the ordinary App Store/Play Store Expo Go client,
  without generating native projects or credentials.
- Web and mobile add separate UI runtimes, but the provider registry and pure selection logic stay a
  single source of truth.
- The root repository becomes an npm workspace monorepo. Expo SDK 54 discovers workspace
  dependencies automatically, but its default Metro `watchFolders` omit root application source.
  The mobile Metro config therefore adds only the shared root `src` directory so the canonical
  registry and resolver can be bundled directly; it preserves Expo's default resolver and module
  paths and blocks `.env*` files from Metro resolution.
- The direct root Expo alignment edge also makes the security overrides deterministic for npm
  versions affected by workspace-boundary override resolution. Removing that edge or changing the
  patched Metro/PostCSS versions requires repeating install, audit, Doctor, and both-platform export
  validation.
- Expo Go is intentionally not presented as the production runtime. Native extensions, background
  services, store branding, and release signing remain unavailable in this scope.
- On iOS, MapKit cannot remove its native base map; the opaque GSI pale `UrlTile` is rendered above
  it, but MapKit may still contact Apple's map service. Android uses `mapType="none"` beneath the GSI
  tiles. This platform/privacy difference is documented and covered by export/type validation plus
  the manual Expo Go device checklist.

## Alternatives considered

- **WebView wrapper:** rejected because it would only package the existing browser experience and
  would not validate native interaction or permissions.
- **Capacitor wrapper:** retained only as historical v2 context; it cannot be opened in Expo Go and
  therefore does not meet this request.
- **MapLibre React Native:** rejected for this demo because it needs native code not bundled in Expo
  Go.
- **Duplicate mobile registry:** rejected because provider metadata, coverage, licenses, and era
  decisions would drift between clients.

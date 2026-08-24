# Title

Add an Expo Go mobile time-travel map demo

## Summary

Add a native React Native client under `apps/mobile` that demonstrates Chronomap on a physical iOS
or Android device through Expo Go. Preserve the existing Web/PWA client and reuse its canonical GSI
registry and pure era-resolution behavior.

## Context

Owner request dated 2026-08-24; ADR-007. This is a post-v1 demonstration extension and is not part
of the v0.1.0 release gate. Expo SDK 57 is the selected current stable SDK. Expo Go includes the
native code for `react-native-maps`, `expo-location`, `@react-native-community/slider`, and
`react-native-safe-area-context`; custom native modules are forbidden in this issue.

GitHub Issue: [#114](https://github.com/Saber5656/chronomap/issues/114)

## Scope

### Repository and dependency boundary

- Add root npm workspace `apps/mobile`; continue using one committed root `package-lock.json` and
  root `npm ci`.
- Add `apps/mobile/package.json`, `app.json`, `index.ts`, `tsconfig.json`, `App.tsx`, and a small
  `src/` tree. Do not generate or commit `ios/` or `android/` directories.
- Add root scripts:
  - `mobile:start`: Expo LAN server / QR entry for Expo Go.
  - `mobile:typecheck`: mobile TypeScript gate.
  - `mobile:doctor`: pinned `expo-doctor` compatibility gate.
  - `mobile:export`: non-interactive Android and iOS JS/static export gate.
- Extend root lint/format/CI coverage to the mobile TypeScript/TSX files without changing Web
  runtime dependencies or the Pages deployment artifact.

### Shared contracts

- Move only Web-neutral GSI basemap constants into `src/providers/layers/gsiBasemap.ts`; preserve
  existing exports from `src/map/mapController.ts` for compatibility.
- `apps/mobile/src/model.ts` imports:
  - canonical `src/providers/layers/gsi.layers.json`,
  - `loadRegistry`, `resolve`, and `LayerEntry` from the root layer package,
  - shared GSI basemap URL/attribution constants.
- `model.ts` owns these pure mobile adapters:
  - `MobileRegion` (`latitude`, `longitude`, `latitudeDelta`, `longitudeDelta`),
  - `regionToBbox(region)` with valid latitude/longitude clamping,
  - `regionToZoom(region)` clamped to the Web `ZOOM_MIN..ZOOM_MAX` contract,
  - `createMobileRegistry(currentYear)` using `loadRegistry(..., featureFlags: {})`,
  - `resolveMobileLayer({ year, region, currentYear, registry })` returning the root resolution and
    resolved `LayerEntry | null`.
- No provider record or layer-resolution branch may be copied into the mobile app.

### Native demo behavior

- Initial region: Tokyo Station area at a zoom where historical GSI tiles are available.
- Initial year: 1965, so the expected canonical layer is `gsi-ort-old10`.
- Render a full-screen `MapView` with:
  - GSI pale `UrlTile` basemap,
  - one resolved historical `UrlTile` overlay keyed by layer ID,
  - platform-safe base-map behavior (`none` on Android, standard MapKit below the opaque GSI tile on
    iOS),
  - rotation/pitch disabled for a stable demo.
- Re-resolve when map movement, year, or current year changes. If the selected year snaps to the
  nearest available era, expose that fact in the UI. If no layer covers the viewport/zoom, show a
  useful no-coverage state without hiding the basemap.
- Bottom controls:
  - year value and native year slider,
  - active era/title badge,
  - present-day reset,
  - historical overlay opacity slider,
  - GSI attribution link.
- Top controls:
  - app/demo identity,
  - JA/EN toggle,
  - explicit foreground-location button.
- Location behavior:
  - never request permission on boot,
  - on tap call `requestForegroundPermissionsAsync`, then one balanced-accuracy fix,
  - animate to the fix and show a static marker for that one-shot fix when granted,
  - show local denied/unavailable/error feedback and keep the Tokyo demo usable otherwise,
  - no background tracking or persistence.
- Layout must use safe-area insets, provide accessibility labels/roles, keep touch targets at least
  44 points, and remain usable at 320-point width and with enlarged text.

### Documentation

- README Japanese/English development tables include Expo Go setup, same-LAN QR flow, tunnel
  fallback, compatible SDK requirement, and commands.
- State clearly that Expo Go is a demo playground, not a store-ready build; document online-tile and
  platform limitations.
- Add a manual device checklist covering iOS and Android launch, time change, map movement, opacity,
  present reset, permission granted, and permission denied.

## Acceptance Criteria

- [ ] `npm ci` installs Web and mobile workspaces from the root lockfile.
- [ ] `npm run mobile:start` starts a LAN QR entry usable by an SDK 57 Expo Go client.
- [ ] The initial Tokyo/1965 view resolves and displays `gsi-ort-old10` over the GSI pale basemap.
- [ ] Year changes, map movement, present reset, and opacity changes update the visible native demo.
- [ ] Location permission is user-triggered only; granted and denied paths preserve a usable app.
- [ ] JA/EN, attribution, no-coverage/snapped feedback, safe areas, and baseline accessibility are
  present.
- [ ] Mobile pure model tests cover Tokyo historical selection, present-day selection, no coverage,
  bbox clamping, and zoom clamping.
- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build`,
  `npm run validate:registry`, `npm run mobile:doctor`, and `npm run mobile:export` pass.
- [ ] Existing applicable PWA and security gates pass with no Web behavior regression.
- [ ] Independent `tech-mobile` review and applicable QA/security review have no unresolved blocker.

## Validation

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate:registry
npm run validate:pwa
npm run validate:commons:off
npm run mobile:doctor
npm run mobile:export
git diff --check
```

Manual Expo Go matrix (owner/device tester when a physical device is available):

| Platform | Launch | 1965 layer | Pan/coverage | Opacity | Present reset | Location grant | Location deny |
|---|---|---|---|---|---|---|---|
| iOS Expo Go SDK 57 | pending | pending | pending | pending | pending | pending | pending |
| Android Expo Go SDK 57 | pending | pending | pending | pending | pending | pending | pending |

## Dependencies

- Existing issues 14, 15, 17, and 39: registry, GSI dataset, resolution, and JA/EN language policy.
- Existing Web v0.1.0 baseline at `56463df1362aad36097c612348d50d252c912a38`.
- Human-maintainer dependency approval is provided by the explicit request to add an Expo Go app;
  no credentials or store services are approved.

## Non-goals

App Store / Google Play publication; EAS credentials or signing; custom development client;
background location; offline tile caching/prefetch; POI/share/import parity; native share extension;
accounts; analytics; release/tag/merge; Konjaku runtime enablement.

## Design References

ADR-007; DESIGN §2.4; DESIGN §4; ISSUE_PLAN issue 49; ADR-003; ADR-004; ADR-005; ADR-006.

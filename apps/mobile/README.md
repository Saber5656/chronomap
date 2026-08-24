# Chronomap Expo Go demo

This workspace is the native iOS/Android demonstration client from
[ADR-007](../../docs/decisions/ADR-007-expo-go-mobile-demo.md). The production Web/PWA client stays
at the repository root.

## Expo Go で確認する

前提:

- repository の `.nvmrc` に記載された Node.js と npm
- SDK 54 対応 Expo Go（iOS は [App Store](https://apps.apple.com/app/expo-go/id982107779)、Android は [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)）
- Mac/PC と実機が同じ LAN（LAN 制限時は tunnel を使用）
- GSI tile を取得できるオンライン接続

repository root で実行します。

```sh
npm ci
npm run mobile:start
```

Terminal に表示された QR code を読み取ります。Android は Expo Go の scanner、iOS は Camera
または Expo Go から開けます。LAN で接続できない場合:

```sh
npm run mobile:start:tunnel
```

Tunnel mode は ngrok 経由で development server への外部経路を作ります。信頼できる session
だけで使用し、確認後は `Ctrl+C` で server を停止してください。

## Run with Expo Go

Prerequisites:

- The Node.js version in the repository `.nvmrc` and npm
- An SDK 54-compatible Expo Go client from the
  [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) or
  [Android Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- Device and computer on the same LAN, or tunnel mode when LAN discovery is blocked
- An online connection for GSI tiles

Run from the repository root:

```sh
npm ci
npm run mobile:start
```

Scan the terminal QR code with Expo Go on Android or Camera/Expo Go on iOS. If LAN access is
blocked, run `npm run mobile:start:tunnel`.

Tunnel mode creates an externally reachable route to the development server through ngrok. Use it
only for a trusted session and stop the server with `Ctrl+C` afterward.

## Demo flow

| Step             | Expected result                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Launch           | Tokyo Station opens at 1965 with the canonical `gsi-ort-old10` overlay.                              |
| Move / zoom      | The center coordinates and coverage-driven active layer update.                                      |
| Year slider      | The closest canonical GSI era appears; a snap notice appears between eras.                           |
| Opacity slider   | The historical image fades over the GSI pale basemap.                                                |
| Today / 現在     | The year moves to the current year and resolves present-day seamless imagery at a supported zoom.    |
| Locate / 現在地  | Permission is requested only now; grant animates to the fix and denial leaves the Tokyo demo usable. |
| 日本語 / English | All demo controls and feedback switch language.                                                      |
| Attribution      | The GSI terms page opens outside the app.                                                            |

## Automated verification

Run from the repository root:

```sh
npm run mobile:doctor
npm run mobile:typecheck
npm run mobile:export
npx vitest run tests/unit/mobile/model.spec.ts
```

`mobile:export` creates Android and iOS Hermes bundles without generating `android/` or `ios/`
projects. It proves Metro can bundle the shared root registry/resolver but is not a substitute for
the physical-device checklist.

## Manual device checklist

| Platform | SDK / OS | QR launch | 1965 layer | Pan / coverage | Opacity | Today | Location grant | Location deny |
|---|---|---|---|---|---|---|---|---|---|
| iOS Expo Go | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Android Expo Go | pending | pending | pending | pending | pending | pending | pending | pending | pending |

Record physical-device results in GitHub Issue #114 or its PR. An agent-side static export must not
be recorded as a passed physical-device test.

## Deliberate limits

- Expo Go playground only; no EAS/store build, signing, app-store credentials, or custom native code.
- Foreground one-shot location only, rendered as a static fix marker; no background service, continuous location tracking, analytics, or coordinate persistence.
- Online GSI raster tiles only; no bulk download, prefetch, or offline tile cache.
- No mobile POI, inbound share, native share extension, or release parity in this issue.
- iOS MapKit cannot use `mapType="none"`; an opaque GSI pale `UrlTile` covers the standard native basemap, but MapKit may still contact Apple's map service underneath it. Android uses `mapType="none"`.

# chronomap

現在地から過去を遡れるタイムトラベル地図アプリ

## これは何か / What it is

chronomap は、現在地または共有された座標を地図上で確認し、年代スライダーで国土地理院の
過去の空中写真を切り替える静的クライアントサイド PWA です。周辺の Wikipedia 記事を表示し、
選択した地点を別の地図アプリへ渡す機能も、利用者の操作に応じてブラウザ内で実行します。

chronomap is a client-side PWA for viewing the current or shared coordinates on a map and switching
through historical GSI aerial-photo layers with a year slider. It can show nearby Wikipedia articles
and hand a selected point to another map app after the user chooses that action.

<!-- Screenshot placeholder: add a verified product screenshot at release time. -->

### 試す / Try it

GitHub Pages の入口（Pages 有効化後）: <https://saber5656.github.io/chronomap/>

GitHub Pages entry point (after Pages is enabled): <https://saber5656.github.io/chronomap/>

### 機能 / Features

- 年代スライダーと GSI の過去空中写真レイヤー。
- 許諾ゲート通過後に `VITE_ENABLE_KONJAKU=true` で地図レイヤーへ追加できる今昔マップ registry。現状の実行 registry は GSI のみで、About のクレジット行だけ flag ON 時に表示します。
- ズームした地点の Wikipedia / Wikimedia 記事検索と記事詳細。
- 共有 URL、Android の Web Share Target、貼り付けによる座標・地図 URL の取り込み。
- 選択した地点を Google マップ、Apple マップ、または `geo:` URI へ渡す操作。
- インストール後のアプリシェルのオフライン起動と、日本語 / English の切り替え。

- A year slider and historical GSI aerial-photo layers.
- A Konjaku Map registry reserved for a later permission-gated integration. With `VITE_ENABLE_KONJAKU=true`, the current build exposes its attribution in About only; the runtime layer registry remains GSI-only until ADR-006 is approved.
- Nearby Wikipedia / Wikimedia article search and article details.
- Shared URLs, Android Web Share Target, and pasted coordinates or map URLs.
- An explicit action to hand a selected point to Google Maps, Apple Maps, or a `geo:` URI.
- Offline startup of the installed app shell and a Japanese / English language toggle.

## Expo Go モバイルデモ / Expo Go mobile demo

### 日本語

`apps/mobile` には、既存 Web/PWA を置き換えない React Native のデモがあります。東京駅周辺の
1965 年から始まり、地図移動、年代変更、過去レイヤーの濃さ、現在へのリセット、明示的な
現在地取得を iOS / Android のネイティブ UI で確認できます。GSI registry と年代解決ロジックは
Web 版と共有しています。

1. `.nvmrc` の Node.js、npm、SDK 54 対応 Expo Go（iOS は [App Store](https://apps.apple.com/app/expo-go/id982107779)、Android は [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)）を用意します。
2. Mac/PC と実機を同じ LAN に接続します。
3. repository root で次を実行し、表示された QR code を Expo Go で読み取ります。

```sh
npm ci
npm run mobile:start
```

LAN から開けない場合は `npm run mobile:start:tunnel` を使用できます。tunnel は ngrok 経由で
development server への外部経路を作るため、信頼できる session だけで使用し、確認後は server を
停止してください。地図画像はオンラインの GSI tile なので通信が必要です。Expo Go はデモ用 playground であり、App Store / Google Play
向け build、署名、native share extension、background location、POI parity はこの実装の対象外です。
詳しい確認項目は [mobile README](apps/mobile/README.md) を参照してください。

### English

`apps/mobile` contains a React Native demo that complements rather than replaces the Web/PWA
client. It starts at Tokyo Station in 1965 and demonstrates native map movement, year selection,
overlay opacity, present-day reset, and user-triggered foreground location on iOS and Android. It
shares the GSI registry and era resolver with the Web client.

1. Install the Node.js version in `.nvmrc`, npm, and the SDK 54-compatible Expo Go client from the
   [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) or
   [Android Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent).
2. Put the computer and device on the same LAN.
3. From the repository root, run the commands below and scan the displayed QR code with Expo Go.

```sh
npm ci
npm run mobile:start
```

Use `npm run mobile:start:tunnel` if LAN discovery is blocked. Tunnel mode creates an externally
reachable route to the development server through ngrok; use it only for a trusted session and stop
the server afterward. GSI map imagery requires a network connection. Expo Go is the requested demo playground, not a store-ready binary; signing, store
builds, native share extensions, background location, and POI parity are outside this scope. See the
[mobile README](apps/mobile/README.md) for the device checklist.

## 他の地図アプリから開く / Opening from other map apps

### 日本語

他の地図アプリから共有された場所を chronomap へ渡す方法は次のとおりです。共有値は `/share`
で文字列として解析され、短縮 URL の展開は行いません。

| 方法                 | Android                                   | iOS / iPadOS                       | Desktop                              | 手順・仕様                                                                      |
| -------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Android の共有シート | 対応ブラウザとインストール済み PWA が必要 | —                                  | —                                    | [Web Share Target と `/share`](docs/issues/35-share-target-route.md)            |
| `geo:` リンク        | インストール済み PWA は manifest 経由     | v1 では未登録                      | 対応ブラウザでメニューから登録を要求 | [`geo:` protocol handler](docs/integrations/protocol-handler.md)                |
| iOS ショートカット   | —                                         | iOS 16+ の「ショートカット」アプリ | —                                    | [iOS ショートカットの手順](docs/integrations/ios-shortcut.md)                   |
| 貼り付け / 手動 URL  | 利用可能                                  | 利用可能                           | 利用可能                             | [ImportSheet の貼り付けフォールバック](docs/issues/36-import-paste-fallback.md) |

`geo:` の対応は OS・ブラウザ・PWA のインストール状態に依存します。iOS のネイティブ共有
ターゲット登録は v1 の対象外なので、[ショートカットの手順](docs/integrations/ios-shortcut.md)
または貼り付けを使ってください。

### English

Use one of the following paths to send a location shared from another map app to chronomap.
Shared values are parsed by `/share`; short-link expansion is not performed.

| Method              | Android                                            | iOS / iPadOS         | Desktop                                               | Guide / specification                                                 |
| ------------------- | -------------------------------------------------- | -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Android share sheet | Requires a supporting browser and an installed PWA | —                    | —                                                     | [Web Share Target and `/share`](docs/issues/35-share-target-route.md) |
| `geo:` link         | Installed PWAs use the manifest handler            | Not registered in v1 | The menu requests registration in supporting browsers | [`geo:` protocol handler](docs/integrations/protocol-handler.md)      |
| iOS Shortcut        | —                                                  | Shortcuts on iOS 16+ | —                                                     | [iOS Shortcut recipe](docs/integrations/ios-shortcut.md)              |
| Paste / manual URL  | Available                                          | Available            | Available                                             | [ImportSheet paste fallback](docs/issues/36-import-paste-fallback.md) |

Whether a `geo:` link is handled depends on the OS, browser, and PWA installation state. Native iOS
share-target registration is out of scope for v1; use the [Shortcut recipe](docs/integrations/ios-shortcut.md)
or the paste fallback instead.

## プライバシー / Privacy

### 日本語

- chronomap にアプリ用サーバー、Cookie、アクセス解析、トラッキングはありません。現行 build の地図タイルのリクエストから表示範囲が国土地理院（GSI）へ伝わります。今昔マップは現在 About の出典表示だけで、runtime layer registry には含まれないため、現行 build から ktgis.net へのタイルリクエストは発生しません。ADR-006 の許諾後に実ランタイムへ追加する場合は、その送信先を改めて明示します。POI を有効にしてズーム13以上のときは、記事検索のため地図の中心座標を Wikimedia へ送信します。
- `localStorage` に保存するキーは `chronomap.lang` と `chronomap.onboarded` だけです。インストール後はアプリシェルがサービスワーカーの CacheStorage に残ることがあります。
- Expo Go デモは利用者が「現在地」を押した場合だけ foreground location を1回取得し、座標を永続化しません。表示範囲は GSI tile request から国土地理院へ伝わります。iOS では `react-native-maps` が標準 MapKit を GSI tile の下で使用するため、Apple の map service にも表示範囲等が送信される可能性があります。Android は GSI tile 下の native basemap を無効にします。
- 地図アプリへの座標の引き渡しは明示的な選択時だけ行われ、開いた先では第三者提供元の利用条件とプライバシー方針が適用されます。詳細はアプリ内の About と [ADR-005](docs/decisions/ADR-005-privacy-and-security-posture.md) を参照してください。

### English

- chronomap has no application server, cookies, analytics, or tracking. In the current build, tile requests reveal the viewed area to GSI. Konjaku is currently an About-only attribution entry and is not included in the runtime layer registry, so the current build makes no tile requests to ktgis.net. If ADR-006 later authorizes adding it to the runtime, that destination will be disclosed again. While POI is enabled at zoom 13 or higher, the map center is sent to Wikimedia for article search.
- The only `localStorage` keys saved are `chronomap.lang` and `chronomap.onboarded`. After installation, the app shell may remain in the service worker's CacheStorage.
- The Expo Go demo retrieves foreground location once only after the user taps Locate and does not persist coordinates. Its GSI tile requests reveal the visible area to GSI. On iOS, `react-native-maps` uses standard MapKit below the GSI tiles, so the visible area and related request data may also reach Apple's map service. Android disables the native basemap below the GSI tiles.
- Coordinates are handed to a map provider only after an explicit choice. The destination provider's terms and privacy policy apply. See the in-app About sheet and [ADR-005](docs/decisions/ADR-005-privacy-and-security-posture.md) for details.

## 開発 / Development

### 日本語

前提は `.nvmrc` に指定した Node.js と npm です。

```sh
npm ci
npm run dev
```

| コマンド                       | 内容                             |
| ------------------------------ | -------------------------------- |
| `npm run dev`                  | Vite の開発サーバー              |
| `npm run lint`                 | ESLint                           |
| `npm run typecheck`            | TypeScript 型検査                |
| `npm run test`                 | Vitest の unit / security テスト |
| `npm run e2e`                  | Playwright の E2E テスト         |
| `npm run e2e:ui`               | Playwright UI モード             |
| `npm run build`                | 型検査を含む production build    |
| `npm run preview`              | production build の preview      |
| `npm run format`               | Prettier による整形              |
| `npm run format:check`         | Prettier の検証                  |
| `npm run check:pins`           | GitHub Actions の SHA pin 検証   |
| `npm run validate:registry`    | layer registry の検証            |
| `npm run validate:pwa`         | production PWA artifact の検証   |
| `npm run validate:pwa:preview` | preview PWA の検証               |
| `npm run validate:readme`      | README のローカルリンク検証      |
| `npm run test:watch`           | Vitest の watch モード           |
| `npm run test:security`        | security unit / E2E テスト       |
| `npm run mobile:start`         | Expo Go 用 LAN server / QR       |
| `npm run mobile:start:tunnel`  | LAN が使えない場合の tunnel      |
| `npm run mobile:doctor`        | Expo SDK / dependency 整合性     |
| `npm run mobile:typecheck`     | mobile TypeScript 型検査         |
| `npm run mobile:export`        | Android / iOS bundle export      |

文書の入口は [docs/README.md](docs/README.md) です。[DESIGN.md](docs/DESIGN.md) が設計正本、
[ISSUE_PLAN.md](docs/ISSUE_PLAN.md) が issue の順序と範囲、[docs/issues/](docs/issues/) が個別の
実装仕様です。設計中に scope を超える未知事項が見つかった場合は、既存 issue を無断で広げず、
ISSUE_PLAN §7 のルールに従って新しい issue doc を作成します。

### English

Use the Node.js and npm versions specified by `.nvmrc`.

```sh
npm ci
npm run dev
```

| Command                        | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `npm run dev`                  | Start the Vite development server              |
| `npm run lint`                 | Run ESLint                                     |
| `npm run typecheck`            | Run the TypeScript checker                     |
| `npm run test`                 | Run Vitest unit and security tests             |
| `npm run e2e`                  | Run Playwright end-to-end tests                |
| `npm run e2e:ui`               | Run Playwright in UI mode                      |
| `npm run build`                | Create a production build, including typecheck |
| `npm run preview`              | Preview the production build                   |
| `npm run format`               | Format files with Prettier                     |
| `npm run format:check`         | Check Prettier formatting                      |
| `npm run check:pins`           | Check GitHub Actions SHA pins                  |
| `npm run validate:registry`    | Validate the layer registry                    |
| `npm run validate:pwa`         | Validate the production PWA artifact           |
| `npm run validate:pwa:preview` | Validate a preview PWA                         |
| `npm run validate:readme`      | Validate README local links                    |
| `npm run test:watch`           | Run Vitest in watch mode                       |
| `npm run test:security`        | Run security unit and E2E tests                |
| `npm run mobile:start`         | Start the Expo Go LAN server and QR            |
| `npm run mobile:start:tunnel`  | Start through a tunnel when LAN access fails   |
| `npm run mobile:doctor`        | Check Expo SDK/dependency compatibility        |
| `npm run mobile:typecheck`     | Type-check the mobile client                   |
| `npm run mobile:export`        | Export Android and iOS demo bundles            |

Start with [docs/README.md](docs/README.md). [DESIGN.md](docs/DESIGN.md) is the design source of
truth, [ISSUE_PLAN.md](docs/ISSUE_PLAN.md) defines issue order and scope, and [docs/issues/](docs/issues/)
contains the individual implementation specifications. When an unknown exceeds the current issue's
scope, create a new issue document under the rule in ISSUE_PLAN §7 instead of widening the existing issue.

## データ出典とライセンス / Data sources and licenses

アプリに表示するデータのクレジット文言と、適用される提供元の利用条件を記録しています。
The table records the credit text and provider terms that apply to the data shown by the app.

| 出典 / Source         | 必要な表示・内容 / Required credit or content                                                                                                                                                                                                                                                                                               | 利用条件・参照先 / Terms or reference                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| GSI / 国土地理院      | ベースマップは `地理院タイル（国土地理院）`、レイヤーは registry の `attribution.text`（`全国最新写真（シームレス） / GRUS画像（© Axelspace）` を含む） / basemap is `GSI tiles (Geospatial Information Authority of Japan)`; layers use each registry `attribution.text`, including `全国最新写真（シームレス） / GRUS画像（© Axelspace）` | [GSI tile terms](https://maps.gsi.go.jp/development/ichiran.html)                      |
| 今昔マップ / Konjaku  | 許諾 flag 有効時の `今昔マップ on the web` / when the flag is enabled                                                                                                                                                                                                                                                                       | [Konjaku tile-map service](https://ktgis.net/kjmapw/tilemapservice.html)               |
| Wikipedia / Wikimedia | POI 本文の `Wikipedia (CC BY-SA)` / for POI text                                                                                                                                                                                                                                                                                            | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and the source article |
| chronomap code        | MIT License / MIT License                                                                                                                                                                                                                                                                                                                   | [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)                |

About シートには、読み込まれた registry のクレジットと利用条件へのリンクを表示します。fork や再配布では提供元の表示を保持し、各提供元の利用条件に従ってください。

The About sheet lists the loaded registry credits and links to these terms. Forks and redistributions
must retain provider attribution and follow the provider's terms.

## 貢献・セキュリティ / Contributing and security

貢献方法は [CONTRIBUTING.md](CONTRIBUTING.md) を、脆弱性の報告は [SECURITY.md](SECURITY.md) の非公開手順を参照してください。セキュリティ報告を公開 issue に投稿しないでください。

Contribution guidelines are in [CONTRIBUTING.md](CONTRIBUTING.md). Report suspected vulnerabilities
privately through the process in [SECURITY.md](SECURITY.md); do not open a public issue for a security report.

## ライセンス / License

chronomap のアプリケーションコードは [MIT License](LICENSE) で配布しています。データと記事本文には各提供元の利用条件と表示義務が適用されます。

Chronomap application code is distributed under the [MIT License](LICENSE). Data and article content
remain subject to the terms and attribution requirements of their providers.

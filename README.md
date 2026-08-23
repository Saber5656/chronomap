# chronomap

現在地から過去を遡れるタイムトラベル地図アプリ

## 他の地図アプリから開く / Opening from other map apps

### 日本語

地図アプリで共有した場所を chronomap に渡す方法です。共有 URL は `/share` で解析され、
短縮 URL の展開は行われません。

| 方法                 | Android                                   | iOS / iPadOS                       | Desktop                              | 手順・仕様                                                                      |
| -------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Android の共有シート | インストール済み PWA と対応ブラウザが必要 | —                                  | —                                    | [Web Share Target と `/share`](docs/issues/35-share-target-route.md)            |
| `geo:` リンク        | 対応ブラウザでメニューから登録を要求      | v1 では未登録                      | 対応ブラウザでメニューから登録を要求 | [`geo:` protocol handler](docs/integrations/protocol-handler.md)                |
| iOS ショートカット   | —                                         | iOS 16+ の「ショートカット」アプリ | —                                    | [iOS Shortcut レシピ](docs/integrations/ios-shortcut.md)                        |
| 貼り付け / 手動 URL  | 利用可能                                  | 利用可能                           | 利用可能                             | [ImportSheet の貼り付けフォールバック](docs/issues/36-import-paste-fallback.md) |

`geo:` の対応可否は OS・ブラウザ・PWA のインストール状態に依存します。iOS で共有シートに
ネイティブの share target を登録する機能は v1 の対象外なので、[ショートカットの手順](docs/integrations/ios-shortcut.md)
または貼り付けを使ってください。

### English

Use one of the following paths to send a location shared from another map app to chronomap.
Shared values are parsed by `/share`; short-link expansion is not performed.

| Method              | Android                                               | iOS / iPadOS         | Desktop                                               | Guide / specification                                                 |
| ------------------- | ----------------------------------------------------- | -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Android share sheet | Requires an installed PWA and a supporting browser    | —                    | —                                                     | [Web Share Target and `/share`](docs/issues/35-share-target-route.md) |
| `geo:` link         | The menu requests registration in supporting browsers | Not registered in v1 | The menu requests registration in supporting browsers | [`geo:` protocol handler](docs/integrations/protocol-handler.md)      |
| iOS Shortcut        | —                                                     | Shortcuts on iOS 16+ | —                                                     | [iOS Shortcut recipe](docs/integrations/ios-shortcut.md)              |
| Paste / manual URL  | Available                                             | Available            | Available                                             | [ImportSheet paste fallback](docs/issues/36-import-paste-fallback.md) |

Whether a `geo:` link is handled depends on the OS, browser, and PWA installation state. Native iOS
share-target registration is out of scope for v1; use the [Shortcut recipe](docs/integrations/ios-shortcut.md)
or the paste fallback instead.

### プライバシー（日本語）

詳細は [ADR-005: Privacy & security posture](docs/decisions/ADR-005-privacy-and-security-posture.md) を参照してください。

- 共有 URL は文字列として解析し、chronomap が短縮 URL を展開したり、ユーザーが渡した URL を取得したりしません。
- iOS Shortcut は共有値を `/share?text=...` の URL に含めます。機密情報を共有しないでください。
- 地図タイルと、明示的に有効にした POI 機能のリクエストは各提供元へ直接送信されます。アクセス解析・広告トラッキングはありません。
- `localStorage` には言語とオンボーディング完了状態だけを保存します。

### Privacy facts (English)

See [ADR-005: Privacy & security posture](docs/decisions/ADR-005-privacy-and-security-posture.md) for the full policy.

- The app parses shared URLs as strings; it does not expand short links or fetch user-supplied URLs.
- The iOS Shortcut places the shared value in the `/share?text=...` URL. Do not forward secrets.
- Map-tile and explicitly enabled POI requests go directly to their providers; chronomap sends no analytics or advertising-tracking events.
- `localStorage` stores only language and onboarding-completion state.

## ライセンスとデータ出典

このリポジトリのアプリケーションコードは MIT License です。詳細は [LICENSE](LICENSE)
を参照してください。

地図タイル、今昔マップ、Wikipedia / Wikimedia の記事本文には、それぞれ提供元の
利用条件と表示義務があります。fork や再配布でも、提供元の attribution を保持してください。

必要な表示文言と参照先は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にまとめています。

## License and data attribution

The application code in this repository is licensed under the MIT License. See [LICENSE](LICENSE).

Map tiles, Konjaku Map content, and Wikipedia / Wikimedia article content are subject to their own
provider terms and attribution requirements. Forks and redistributions must retain provider
attributions.

Required credit text and source links are tracked in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

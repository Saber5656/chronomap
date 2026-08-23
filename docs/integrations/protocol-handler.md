# `geo:` protocol handler

## 日本語

| 環境 | 動作 |
| --- | --- |
| `protocol_handlers` に対応するインストール済みPWA | `geo:` を `/chronomap/share?text=%s` に渡します。 |
| Desktop Chromium / Firefox | メニューの「geo リンクをこのアプリで開く」を押したときだけ登録を要求します。 |
| iOS Safari | v1では登録しません。 [iOS Shortcutレシピ](ios-shortcut.md)または貼り付けを使います。 |
| API非対応ブラウザ | 登録メニューは表示せず、通常の地図表示には影響しません。 |

登録は自動実行されません。明示的なメニュー操作でブラウザへ登録を要求し、拒否された場合はエラーToastを表示します。
`%s` の値は `/share` の `URLSearchParams` で一度だけデコードされます。二重エンコードされた値は座標として解釈せず、ImportSheetへ渡されます。

## English

| Environment | Behavior |
| --- | --- |
| Installed PWA with `protocol_handlers` support | Sends `geo:` to `/chronomap/share?text=%s`. |
| Desktop Chromium / Firefox | Requests registration only after the user chooses “Open geo links in this app”. |
| iOS Safari | Not registered in v1; use the [iOS Shortcut recipe](ios-shortcut.md) or paste fallback. |
| Browser without the API | Hides the registration item and leaves normal map behavior unchanged. |

Registration never runs automatically. The `/share` route decodes `%s` exactly once; a double-encoded value is not interpreted as coordinates and is sent to ImportSheet.

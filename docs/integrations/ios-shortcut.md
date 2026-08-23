# iOS ショートカットで共有 URL を chronomap に渡す

このレシピは、iPhone または iPad の共有シートから地図 URL / テキストを受け取り、
chronomap の `/share` へ渡す「chronomapで開く」ショートカットを作る手順です。
ネイティブの共有拡張ではなく、iOS 16 以降の「ショートカット」アプリを使います。

## 日本語

### 前提

- iOS 16 以降（iPadOS を含む）。
- Apple の「ショートカット」アプリ。
- 共有元の「マップ」または Google Maps などが、URL またはテキストを共有できること。

### ショートカットを作る

1. 「ショートカット」アプリで「新規ショートカット」を作り、名前を `chronomapで開く` にします。
2. ショートカットの詳細を開き、「共有シートに表示」をオンにします。
3. 共有シートの入力設定で「受け取る種類」を `URL とテキスト` にします。画像やファイルはこのショートカットの入力対象にしません。
4. 次のアクションを、上から順番に追加します。アクション検索では、表の日本語名または英語名を使えます。

   | 順番 | 日本語 UI | English UI | 設定 |
   | --- | --- | --- | --- |
   | 1 | 「テキスト」 | `Text` | 次の固定値だけを入力する: `https://saber5656.github.io/chronomap/share?text=` |
   | 2 | 「URLエンコード」 | `URL Encode` | 入力を「ショートカットの入力」(`Shortcut Input`) にする |
   | 3 | 「リスト」 | `List` | 1 の出力、2 の出力をこの順番でリストに追加する |
   | 4 | 「テキストを結合」 | `Combine Text` | 3 のリストを入力し、区切り文字は空にする |
   | 5 | 「URLを開く」 | `Open URLs` | 4 の結合結果を入力にする |

   「リスト」では、マジック変数を使って「テキスト」の出力を先に置き、
   その後ろに「URLエンコード」の出力を置きます。「テキストを結合」の区切り文字は空にします。
   `text=` を含む固定値全体を URL エンコードしたり、共有入力を二重にエンコードしたりしないでください。

5. 保存して編集を終了します。共有シートに表示されない場合は、共有シートの「その他」またはアクション編集画面で `chronomapで開く` を有効にします。

このレシピで使う固定エンドポイントは、Issue 06 で定めた canonical deployed origin の正本です。
カスタムドメインへ移行するときは、この値とリリース時に公開する iCloud ショートカットを更新してください。

```text
https://saber5656.github.io/chronomap/share?text=
```

### 使う

1. 「マップ」または Google Maps で場所を開きます。
2. 「共有」をタップします。
3. 「chronomapで開く」を選びます。

共有された文字列は `/share?text=...` に渡され、chronomap が対応する URL または座標を解析して場所を開きます。
対応する座標を見つけられない場合は、アプリ内の ImportSheet（「場所を貼り付けて開く」）に引き継がれ、
理由に応じた案内が表示されます。

### iCloud 共有リンク

`TODO(owner): publish link at release`

リリース前に owner がショートカットを公開し、上の手順で作成したものと同じ入力種別・エンドポイント・
アクション順になっていることを確認してから、ここに iCloud 共有リンクを追加します。リンクの公開は人間が行うリリース作業です。

### トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| Google Maps から `goo.gl` / `maps.app.goo.gl` のような短縮 URL が渡る | chronomap は短縮 URL を展開しません。Google Maps の共有メニューで短縮 URL の「コピー」を使う代わりに、場所の詳細にある「座標をコピー」を使い、chronomap の「場所を貼り付けて開く」に貼り付けてください。共有元アプリやブラウザで完全な URL をコピーできる場合も、それを ImportSheet に貼り付けます。 |
| 「URLを開く」を実行すると Safari が開く | 正常です。このショートカットは URL を開く動作を使うため、iOS の既定のブラウザが開きます。インストール済み PWA のスコープ内 URL が PWA のコンテキストで扱われる場合は standalone 表示になることがありますが、ショートカットからの起動方法だけで standalone を強制することはできません。 |
| 共有シートにショートカットが出ない | 「共有シートに表示」がオンか、入力種別が `URL とテキスト` かを確認します。共有元が画像やファイルだけを渡している場合は、このショートカットの対象外です。 |
| 開いたが場所が見つからない | 「URLエンコード」の入力が `ショートカットの入力` になっているか、「テキストを結合」の順序が固定エンドポイント → エンコード済み入力になっているか、区切り文字が空かを確認します。Google/Apple Maps の URL に座標が含まれない場合は、完全な URL または座標を ImportSheet に貼り付けてください。 |
| iCloud リンクを開けない | 現時点では公開リンクを登録していません。上の手順でローカルに作成するか、リリース時の owner 公開を待ってください。 |

### プライバシーと制約

- 共有入力は URL の `text` クエリに入れて `/share` へ移動します。機密情報や、URL に含めたくない文字列は共有しないでください。
- chronomap は共有された URL を文字列として解析し、短縮 URL の展開や、ユーザーが渡した URL への自動アクセスは行いません。
- 地図タイルや、明示的に有効にした POI 機能のリクエストは、それぞれの提供元へ直接送信されます。アクセス解析・広告トラッキングは行いません。

## English

### Prerequisites

- iOS 16 or later, including iPadOS.
- Apple’s Shortcuts app.
- A source app such as Apple Maps or Google Maps that can share a URL or text value.

### Build the Shortcut

1. Open Shortcuts, choose `New Shortcut`, and name it `chronomapで開く` (or another name you prefer).
2. Open the shortcut details and turn on `Show in Share Sheet`.
3. In the share-sheet input settings, set `Receive What’s Passed` to `URLs and Text`. Do not enable images or files for this shortcut.
4. Add these actions in this order. Search for either the Japanese or English label when adding an action.

   | Order | Japanese UI | English UI | Configuration |
   | --- | --- | --- | --- |
   | 1 | `テキスト` | `Text` | Enter only this fixed value: `https://saber5656.github.io/chronomap/share?text=` |
   | 2 | `URLエンコード` | `URL Encode` | Set the input to `ショートカットの入力` (`Shortcut Input`) |
   | 3 | `リスト` | `List` | Add the outputs of steps 1 and 2 to the list in that order |
   | 4 | `テキストを結合` | `Combine Text` | Use the step 3 list as input, with an empty separator |
   | 5 | `URLを開く` | `Open URLs` | Use the combined result from step 4 as the input |

   In `List`, use Magic Variables so the `Text` output comes first and the `URL Encode` output comes second.
   Set `Combine Text` to use the list with no separator. Do not URL-encode the whole fixed endpoint,
   and do not encode the shared input twice.

5. Save the shortcut and leave the editor. If it does not appear in the share sheet, use `More` or the share-sheet action editor to enable `chronomapで開く`.

The fixed endpoint above is the canonical deployed origin defined by Issue 06.
If the project moves to a custom domain, update this value and the iCloud Shortcut published for the release.

```text
https://saber5656.github.io/chronomap/share?text=
```

### Use it

1. Open a place in Apple Maps or Google Maps.
2. Tap `Share`.
3. Choose `chronomapで開く`.

The Shortcut sends the shared value to `/share?text=...`. chronomap parses supported map URLs or coordinates and opens the location.
If no usable coordinates are found, the app hands the value to its ImportSheet (`場所を貼り付けて開く` / “Paste and open a location”) with reason-specific guidance.

### iCloud shared Shortcut link

`TODO(owner): publish link at release`

Before release, the owner must publish the Shortcut and verify that its accepted input types, endpoint, and action order match this recipe, then add the iCloud link here. Publishing the link is a human release step.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Google Maps passes a `goo.gl` or `maps.app.goo.gl` short link | chronomap does not expand short links. Instead of using the generic `Copy` result that contains the short link, use Google Maps’ in-app `Copy coordinates` action, then paste the coordinates into chronomap’s `Paste and open a location` ImportSheet. If the map app or browser can provide the full URL, paste that into ImportSheet instead. |
| `Open URLs` opens Safari | This is expected: the Shortcut opens a URL, so iOS uses the default browser. An installed PWA may display in standalone when the in-scope URL is handled in the PWA context, but the Shortcut alone cannot force standalone mode. |
| The Shortcut is missing from the share sheet | Check that `Show in Share Sheet` is enabled and that the accepted input types are `URLs and Text`. A source that shares only an image or file is not an input for this Shortcut. |
| The page opens but no location is found | Check that `URL Encode` receives `Shortcut Input`, and that `Combine Text` orders the fixed endpoint before the encoded input with no separator. If a Google or Apple Maps URL does not contain coordinates, paste the full URL or coordinates into ImportSheet. |
| The iCloud link cannot be opened | No public link is registered yet. Build the Shortcut locally using the steps above, or wait for the owner’s release-time publication. |

### Privacy and limitations

- The shared value is placed in the URL’s `text` query while navigating to `/share`. Do not share secrets or text that should not appear in a URL.
- chronomap parses shared URLs as strings. It does not expand short links or automatically fetch a user-supplied URL.
- Map-tile requests and requests made by the explicitly enabled POI feature go directly to their respective providers. chronomap does not send analytics or advertising-tracking events.

### References

- [Canonical deployment and `/share` route](../issues/06-pages-deploy-workflow.md)
- [Map-app integration research](../research/map-app-integration.md)
- [Privacy and security posture](../decisions/ADR-005-privacy-and-security-posture.md)
- [Apple Shortcuts: input types](https://support.apple.com/en-gb/guide/shortcuts/apd7644168e1/ios)
- [Apple Shortcuts: open a URL scheme](https://support.apple.com/en-lamr/guide/shortcuts/apd68802640c/ios)

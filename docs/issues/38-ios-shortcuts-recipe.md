# Title

Author iOS Shortcuts recipe and integration documentation

## Summary

Write `docs/integrations/ios-shortcut.md`: a step-by-step recipe letting iOS users add a share-
sheet Shortcut ("chronomapで開く") that forwards shared map URLs to the `/share` route, plus a
README integration section covering all platforms.

## Context

iOS Safari cannot register PWAs as share targets (research/map-app-integration.md §1). The
Shortcuts recipe is the v1 iOS answer (owner-confirmed scope), shipped as documentation — no app
code.

## Scope

- `docs/integrations/ios-shortcut.md` (Japanese primary, English section below):
  1. Prerequisites (iOS 16+, ショートカット app).
  2. Build steps (exact action names in ja + en UI labels): 新規ショートカット → 「共有シートに
     表示」ON, 受け取る種類: URL とテキスト → アクション「テキスト」= `https://saber5656.github.io/
     chronomap/share?text=` → アクション「URLエンコード」(input: ショートカット入力) →
     「テキストを結合」→「URLを開く」。
  3. Usage: マップ/Google マップ → 共有 → 「chronomapで開く」.
  4. Troubleshooting: shortlink case (Google Maps共有は goo.gl になる → 共有メニューで
     「コピー」ではなくアプリ内の「座標をコピー」を使う手順、または chronomap 側 ImportSheet
     ガイダンスに従う), Safari で開く挙動, PWA 起動との関係 (installed PWA opens in standalone
     when applicable).
  5. Placeholder section for an iCloud shared-shortcut link: `TODO(owner): publish link at
     release` (ADR-006-style human step; also listed in 48's checklist).
- README: "他の地図アプリから開く / Opening from other map apps" section (concise matrix:
  Android share sheet / iOS Shortcut / geo: links / paste) linking the docs above and
  protocol-handler.md (37).

## Detailed Requirements

1. Steps must be reproducible without screenshots (text-exact action names); screenshots optional
   placeholders `![](TODO)` acceptable but steps must stand alone.
2. The recipe URL must use the canonical deployed origin (06) — single source constant noted for
   future custom-domain change.
3. English translation of the full recipe included (issue language rule: this doc is user-facing,
   bilingual like README).

## Acceptance Criteria

- [ ] A maintainer following the doc on a real iOS device reaches a working share-sheet entry that
      opens chronomap at the shared location (manual evidence: step-list confirmation in PR).
- [ ] Shortlink troubleshooting path verified once manually (Google Maps share on iOS).
- [ ] README section added (ja+en), links resolve.

## Validation

Manual on-device walkthrough (human step — owner or tester with iPhone); docs lint (links).

## Dependencies

35 (`/share` deployed behavior), 06 (canonical URL).

## Non-goals

Native share extension (v2/Capacitor), publishing the iCloud link (owner release step),
screenshot production.

## Design References

DESIGN §9.5; research/map-app-integration.md §1/§4.

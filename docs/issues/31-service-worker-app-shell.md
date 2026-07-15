# Title

Add service worker: app-shell precache, cross-origin NetworkOnly, prompt-update flow

## Summary

Enable the Workbox service worker (vite-plugin-pwa): precache the built shell, explicit
NetworkOnly for all cross-origin requests (no tile/API caching), SPA navigation fallback, and the
"update available" toast flow.

## Context

DESIGN §10.2 and ADR-005: tiles/APIs must NOT be cached (provider ToS + privacy); §12.2 A10
requires a sane update path so a bad deploy can be superseded predictably.

## Scope

- vite-plugin-pwa config: `registerType: 'prompt'`; workbox options:
  - `globPatterns` for shell assets (js/css/html/svg/png/webmanifest);
  - `navigateFallback: 'index.html'` (scoped under base; `/share` must fall back too);
    `navigateFallbackDenylist`: none needed beyond defaults — verify `/share` works installed;
  - `runtimeCaching`: one rule `({url}) => url.origin !== self.location.origin` → handler
    `NetworkOnly` (explicit, self-documenting).
- `src/app/swUpdate.ts`: register via `virtual:pwa-register` `useRegisterSW`-equivalent vanilla
  API; on `needRefresh` → toast (40's Toast; until merged use a minimal inline toast, replaced by
  40) i18n `sw.updateReady` (`新しいバージョンがあります`) with action `sw.reload` (`更新`) →
  `updateServiceWorker(true)`; on `offlineReady` → one-time toast `sw.offlineReady`.
- Dev behavior: SW disabled in `npm run dev` (devOptions off); e2e runs against built preview.

## Detailed Requirements

1. Installed-offline behavior: airplane mode → app shell loads, map tiles blank, POI error state —
   no white screen (e2e: context offline flag against preview build).
2. No `Cache-Control` assumptions: precache uses revisioned URLs (Workbox default).
3. Update flow must not auto-reload mid-session without user consent (prompt type).
4. Confirm no cross-origin response ever enters CacheStorage (e2e asserts cache keys ⊆ same-origin).

## Acceptance Criteria

- [ ] e2e: load preview → SW active; offline reload → shell renders; CacheStorage contains only
      same-origin revisioned entries.
- [ ] e2e: deploy-simulated update (rebuild with changed const + re-serve) → toast appears;
      accepting reloads to new version (assert via `__APP_VERSION__` bump).
- [ ] `/share?text=geo:35,139` navigation works offline-ish (shell loads; parser runs client-side).
- [ ] Lighthouse PWA installable: all checks green.

## Validation

`tests/e2e/sw.spec.ts` (Playwright with `offline` context toggling) + Lighthouse run in PR.

## Dependencies

30 (manifest/plugin), 08. Toast final form in 40.

## Non-goals

Tile/API caching (never), background sync, push notifications, periodic updates.

## Design References

DESIGN §10.2, §12.2 A10, §13; ADR-005.

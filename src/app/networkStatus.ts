import { createActions } from "../state/actions";
import type { AppState } from "../state/appState";
import type { Store } from "../state/store";
import { t } from "../ui/i18n";

export const OFFLINE_HYSTERESIS_MS = 5_000;

export function mountNetworkStatus(store: Store<AppState>): { destroy(): void } {
  const actions = createActions(store);
  let lastOfflineNoticeAt = Number.NEGATIVE_INFINITY;
  let lastOnlineNoticeAt = Number.NEGATIVE_INFINITY;

  const offline = (): void => {
    if (store.get().ui.offline) return;
    const now = Date.now();
    actions.setOffline(true);
    if (now - lastOfflineNoticeAt < OFFLINE_HYSTERESIS_MS) return;
    lastOfflineNoticeAt = now;
    actions.showToast("error", t("net.offline", {}, store.get().ui.lang));
  };

  const online = (): void => {
    if (!store.get().ui.offline) return;
    const now = Date.now();
    actions.setOffline(false);
    if (now - lastOnlineNoticeAt < OFFLINE_HYSTERESIS_MS) return;
    lastOnlineNoticeAt = now;
    actions.showToast("info", t("net.backOnline", {}, store.get().ui.lang));
  };

  globalThis.addEventListener?.("offline", offline);
  globalThis.addEventListener?.("online", online);

  return {
    destroy() {
      globalThis.removeEventListener?.("offline", offline);
      globalThis.removeEventListener?.("online", online);
    },
  };
}

export interface TileFailureRecord {
  readonly failures: readonly number[];
  readonly lastNotice: number;
  readonly notify: boolean;
}

export function recordTileFailure(
  now: number,
  failures: readonly number[],
  lastNotice: number,
): TileFailureRecord {
  const current = failures.filter((at) => {
    const age = now - at;
    return age >= 0 && age <= 10_000;
  });
  current.push(now);
  const notify = current.length > 10 && now - lastNotice >= 300_000;
  return { failures: current, lastNotice: notify ? now : lastNotice, notify };
}

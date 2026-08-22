import type { AppState } from "./appState";
import type { Store } from "./store";
import { parseUrlState, serializeUrlState, type SerializableUrlState } from "./urlState";

export const URL_SYNC_DEBOUNCE_MS = 500;

export interface UrlSyncOptions {
  readonly now?: Date;
  readonly location?: Location;
  readonly history?: History;
}

export interface UrlSyncController {
  /** Mark the first map idle boundary as passed and enable URL writes. */
  markIdle(): void;
  /** Connect a map controller's idle subscription. */
  connectIdle(register: (callback: () => void) => () => void): void;
  /** Return the current canonical query string without mutating browser history. */
  getSerialized(): string;
  destroy(): void;
}

function toSerializableState(
  state: Readonly<AppState>,
  labelValue: string | null,
): SerializableUrlState {
  return {
    view: state.view,
    year: state.year,
    requestedLayerId: state.requestedLayerId,
    timeLayer: { opacity: state.timeLayer.opacity },
    poi: { enabled: state.poi.enabled },
    label: labelValue,
  };
}

function mergeUrlState(store: Store<AppState>, patch: ReturnType<typeof parseUrlState>): void {
  store.set((state) => ({
    ...state,
    ...(patch.view === undefined ? {} : { view: patch.view }),
    ...(patch.year === undefined ? {} : { year: patch.year }),
    ...(patch.requestedLayerId === undefined ? {} : { requestedLayerId: patch.requestedLayerId }),
    timeLayer:
      patch.timeLayer === undefined ? state.timeLayer : { ...state.timeLayer, ...patch.timeLayer },
    poi: patch.poi === undefined ? state.poi : { ...state.poi, ...patch.poi },
  }));
}

/**
 * Apply the public URL state before map construction and synchronize selected state back to it.
 * The first map idle is the boundary after which a redirect/import can no longer be overwritten.
 */
export function initUrlSync(
  store: Store<AppState>,
  registryIds: ReadonlySet<string>,
  options: UrlSyncOptions = {},
): UrlSyncController {
  const pageLocation = options.location ?? globalThis.location;
  const pageHistory = options.history ?? globalThis.history;
  const now = options.now ?? new Date();
  const initialPatch =
    pageLocation === undefined ? {} : parseUrlState(pageLocation.search, now, registryIds);
  const labelValue = initialPatch.label ?? null;
  let idle = false;
  let destroyed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeIdle: (() => void) | null = null;

  mergeUrlState(store, initialPatch);

  function getSerialized(): string {
    return serializeUrlState(toSerializableState(store.get(), labelValue), registryIds, now);
  }

  function writeUrl(): void {
    timer = null;
    if (destroyed || !idle || pageLocation === undefined || pageHistory === undefined) return;

    const serialized = getSerialized();
    if (pageLocation.search === serialized) return;
    pageHistory.replaceState(null, "", serialized);
  }

  function scheduleWrite(): void {
    if (destroyed || !idle) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(writeUrl, URL_SYNC_DEBOUNCE_MS);
  }

  const unsubscribeView = store.on((state) => state.view, scheduleWrite);
  const unsubscribeYear = store.on((state) => state.year, scheduleWrite);
  const unsubscribeOpacity = store.on((state) => state.timeLayer.opacity, scheduleWrite);
  const unsubscribePoi = store.on((state) => state.poi.enabled, scheduleWrite);

  return {
    markIdle() {
      if (!destroyed) idle = true;
    },
    connectIdle(register) {
      if (destroyed) return;
      unsubscribeIdle?.();
      unsubscribeIdle = register(() => {
        if (!destroyed) idle = true;
      });
    },
    getSerialized,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      unsubscribeView();
      unsubscribeYear();
      unsubscribeOpacity();
      unsubscribePoi();
      unsubscribeIdle?.();
      unsubscribeIdle = null;
    },
  };
}

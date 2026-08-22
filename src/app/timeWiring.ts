import { YEAR_MIN, type AppState } from "../state/appState";
import { createActions } from "../state/actions";
import type { Store } from "../state/store";
import { resolve as resolveLayer } from "../providers/layers/resolve";
import type { Bbox, LayerEntry, LayerResolution } from "../providers/layers/types";

export interface TimeWiringMap {
  getViewportBbox(): Bbox;
}

export interface TimeWiringOptions {
  readonly currentYear?: number;
}

export interface TimeWiringController {
  resolveNow(): LayerResolution;
  destroy(): void;
}

function currentYearFrom(options: TimeWiringOptions): number {
  const value = options.currentYear ?? new Date().getFullYear();
  return Math.max(YEAR_MIN, Number.isFinite(value) ? Math.floor(value) : YEAR_MIN);
}

/** Keep layer resolution behind the store boundary used by the slider and future overlay code. */
export function createTimeWiring(
  store: Store<AppState>,
  map: TimeWiringMap,
  registry: readonly LayerEntry[],
  options: TimeWiringOptions = {},
): TimeWiringController {
  const actions = createActions(store);
  const currentYear = currentYearFrom(options);
  let destroyed = false;
  let lastResolution: LayerResolution = {
    activeLayerId: null,
    reason: registry.length === 0 ? "registry-empty" : "no-coverage",
    candidates: [],
    snapped: false,
  };

  function resolveNow(): LayerResolution {
    if (destroyed) return lastResolution;
    const state = store.get();
    lastResolution = resolveLayer({
      year: state.year,
      viewBbox: map.getViewportBbox(),
      zoom: state.view.zoom,
      currentYear,
      registry,
      ...(state.requestedLayerId === null ? {} : { overrideId: state.requestedLayerId }),
    });
    actions.setActiveLayer(lastResolution.activeLayerId, {
      candidates: lastResolution.candidates,
      reason: lastResolution.reason,
    });
    return lastResolution;
  }

  const unsubscribeView = store.on(
    (state) => state.view,
    () => resolveNow(),
  );
  const unsubscribeYear = store.on(
    (state) => state.year,
    () => resolveNow(),
  );
  const unsubscribeOverride = store.on(
    (state) => state.requestedLayerId,
    () => resolveNow(),
  );

  resolveNow();

  return {
    resolveNow,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeView();
      unsubscribeYear();
      unsubscribeOverride();
    },
  };
}

export const mountTimeWiring = createTimeWiring;

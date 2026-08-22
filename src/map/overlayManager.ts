import type { ErrorEvent, Map as MapLibreMap, RasterSourceSpecification } from "maplibre-gl";

import type { LayerEntry } from "../providers/layers/types";
import type { AppState } from "../state/appState";
import type { Store } from "../state/store";
import type { MapController } from "./mapController";
import {
  RASTER_CROSSFADE_DURATION_MS,
  runOverlayTransition,
  type OverlayTransitionHandle,
  type OverlayTransitionScheduler,
} from "./overlayTransition";

export const PAST_SOURCE_PREFIX = "chronomap-past-src-";
export const PAST_LAYER_PREFIX = "chronomap-past-";
export const POI_LAYER_PREFIX = "chronomap-poi";
export const USER_LAYER_PREFIX = "chronomap-user";

type StyleLayerLike = Readonly<{ id: string; type?: string }>;

interface LayerOrderMap {
  getLayersOrder?: () => string[];
  getStyle: () => Readonly<{ layers?: readonly StyleLayerLike[] }>;
}

interface OwnedLayer {
  readonly entry: LayerEntry;
  readonly sourceId: string;
  readonly layerId: string;
}

export interface OverlayManagerOptions {
  readonly scheduler?: OverlayTransitionScheduler;
  readonly prefersReducedMotion?: () => boolean;
  readonly debug?: boolean;
}

export interface OverlayManager {
  setLayer(entry: LayerEntry | null, opacity?: number): void;
  setOpacity(value: number): void;
  destroy(): void;
}

function sourceId(entryId: string): string {
  return `${PAST_SOURCE_PREFIX}${entryId}`;
}

function layerId(entryId: string): string {
  return `${PAST_LAYER_PREFIX}${entryId}`;
}

export function pastSourceId(entryId: string): string {
  return sourceId(entryId);
}

export function pastLayerId(entryId: string): string {
  return layerId(entryId);
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** Return the first style layer whose id starts with `prefix`, preserving style order. */
export function firstLayerIdWithPrefix(map: LayerOrderMap, prefix: string): string | undefined {
  const orderedIds = map.getLayersOrder?.();
  if (orderedIds !== undefined) return orderedIds.find((id) => id.startsWith(prefix));

  return map.getStyle().layers?.find((layer) => layer.id.startsWith(prefix))?.id;
}

function styleLayers(map: LayerOrderMap): readonly StyleLayerLike[] {
  const style = map.getStyle();
  if (style.layers !== undefined) return style.layers;

  return (map.getLayersOrder?.() ?? []).map((id) => ({ id }));
}

function firstOverlayBoundary(map: LayerOrderMap): string | undefined {
  const layers = styleLayers(map);
  const boundary = layers.find(
    (layer) =>
      layer.type === "symbol" ||
      layer.id.startsWith(POI_LAYER_PREFIX) ||
      layer.id.startsWith(USER_LAYER_PREFIX),
  );
  return boundary?.id;
}

function attributionText(entry: LayerEntry): string {
  return entry.attribution.text;
}

function rasterSource(entry: LayerEntry): RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [entry.tiles.urlTemplate],
    scheme: entry.tiles.scheme,
    minzoom: entry.tiles.minzoom,
    maxzoom: entry.tiles.maxzoom,
    tileSize: entry.tiles.tileSize,
    attribution: attributionText(entry),
  };
}

function getOwnerWindow(map: MapLibreMap): Window | undefined {
  try {
    return map.getContainer().ownerDocument.defaultView ?? undefined;
  } catch {
    return undefined;
  }
}

function defaultScheduler(map: MapLibreMap): OverlayTransitionScheduler {
  const ownerWindow = getOwnerWindow(map);
  const requestAnimationFrame = ownerWindow?.requestAnimationFrame?.bind(ownerWindow);
  const cancelAnimationFrame = ownerWindow?.cancelAnimationFrame?.bind(ownerWindow);
  const now = ownerWindow?.performance?.now.bind(ownerWindow.performance);

  if (requestAnimationFrame !== undefined && cancelAnimationFrame !== undefined) {
    return {
      requestAnimationFrame,
      cancelAnimationFrame,
      now: now ?? (() => Date.now()),
    };
  }

  return {
    requestAnimationFrame: (callback) =>
      Number(setTimeout(() => callback(now?.() ?? Date.now()), 16)),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
    now: now ?? (() => Date.now()),
  };
}

function defaultReducedMotion(map: MapLibreMap): boolean {
  const ownerWindow = getOwnerWindow(map);
  return ownerWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function isMapRemoved(map: MapLibreMap): boolean {
  return (map as unknown as { _removed?: boolean })._removed === true;
}

interface MapErrorLike extends ErrorEvent {
  readonly sourceId?: string;
}

function isAjaxTileError(event: MapErrorLike): boolean {
  const error = event.error as unknown as { status?: unknown; url?: unknown };
  return (
    typeof event.sourceId === "string" &&
    event.sourceId.startsWith(PAST_SOURCE_PREFIX) &&
    typeof error.status === "number" &&
    typeof error.url === "string"
  );
}

function debugContext(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_E2E === "true";
}

export function createOverlayManager(
  mapController: MapController,
  store: Store<AppState>,
  registry: readonly LayerEntry[] = [],
  options: OverlayManagerOptions = {},
): OverlayManager {
  const map = mapController.getMap();
  const entries = new Map(registry.map((entry) => [entry.id, entry]));
  const scheduler = options.scheduler ?? defaultScheduler(map);
  const reducedMotion = options.prefersReducedMotion ?? (() => defaultReducedMotion(map));
  const shouldDebug = options.debug ?? debugContext();
  const ownedSourceIds = new Set<string>();
  const ownedLayerIds = new Set<string>();

  let destroyed = false;
  let styleReady = map.isStyleLoaded() === true;
  let stableLayer: OwnedLayer | null = null;
  let fadingLayer: OwnedLayer | null = null;
  let transition: OverlayTransitionHandle | null = null;
  let transitionGeneration = 0;
  let desiredEntry: LayerEntry | null = null;
  let desiredOpacity = clampOpacity(store.get().timeLayer.opacity);
  let fadingOpacity = 0;

  function canMutateMap(): boolean {
    return !isMapRemoved(map);
  }

  function removeOwnedLayer(layer: OwnedLayer | null): void {
    if (layer === null || !canMutateMap()) return;

    if (map.getLayer(layer.layerId) !== undefined) map.removeLayer(layer.layerId);
    if (map.getSource(layer.sourceId) !== undefined) map.removeSource(layer.sourceId);
    ownedLayerIds.delete(layer.layerId);
    ownedSourceIds.delete(layer.sourceId);
  }

  function removeAllOwnedLayers(): void {
    if (!canMutateMap()) return;

    for (const id of [...ownedLayerIds]) {
      if (map.getLayer(id) !== undefined) map.removeLayer(id);
      ownedLayerIds.delete(id);
    }
    for (const id of [...ownedSourceIds]) {
      if (map.getSource(id) !== undefined) map.removeSource(id);
      ownedSourceIds.delete(id);
    }
  }

  function cancelTransition(): void {
    transitionGeneration += 1;
    transition?.cancel();
    transition = null;
  }

  function setLayerOpacity(layer: OwnedLayer | null, opacity: number): void {
    if (
      destroyed ||
      layer === null ||
      !canMutateMap() ||
      map.getLayer(layer.layerId) === undefined
    ) {
      return;
    }
    map.setPaintProperty(layer.layerId, "raster-opacity", clampOpacity(opacity));
  }

  function finishWithoutAnimation(layer: OwnedLayer): void {
    setLayerOpacity(layer, desiredOpacity);
    removeOwnedLayer(stableLayer);
    stableLayer = layer;
    fadingLayer = null;
    fadingOpacity = desiredOpacity;
  }

  function addLayer(entry: LayerEntry, opacity: number): OwnedLayer {
    const owned: OwnedLayer = {
      entry,
      sourceId: sourceId(entry.id),
      layerId: layerId(entry.id),
    };
    const beforeId = firstOverlayBoundary(map);

    if (map.getLayer(owned.layerId) !== undefined) map.removeLayer(owned.layerId);
    if (map.getSource(owned.sourceId) !== undefined) map.removeSource(owned.sourceId);

    map.addSource(owned.sourceId, rasterSource(entry));
    ownedSourceIds.add(owned.sourceId);
    map.addLayer(
      {
        id: owned.layerId,
        type: "raster",
        source: owned.sourceId,
        paint: {
          "raster-opacity": clampOpacity(opacity),
          "raster-fade-duration": 0,
        },
      },
      beforeId,
    );
    ownedLayerIds.add(owned.layerId);
    return owned;
  }

  function beginFade(layer: OwnedLayer, from: number, target: number): void {
    fadingLayer = layer;
    fadingOpacity = clampOpacity(from);
    const generation = transitionGeneration + 1;
    transitionGeneration = generation;

    if (reducedMotion()) {
      finishWithoutAnimation(layer);
      return;
    }

    transition = runOverlayTransition({
      from,
      target,
      startedAt: scheduler.now(),
      durationMs: RASTER_CROSSFADE_DURATION_MS,
      scheduler,
      onFrame: (opacity) => {
        if (destroyed || generation !== transitionGeneration || fadingLayer !== layer) return;
        fadingOpacity = opacity;
        setLayerOpacity(layer, opacity);
      },
      onComplete: () => {
        if (destroyed || generation !== transitionGeneration || fadingLayer !== layer) return;
        setLayerOpacity(layer, desiredOpacity);
        removeOwnedLayer(stableLayer);
        stableLayer = layer;
        fadingLayer = null;
        fadingOpacity = desiredOpacity;
        transition = null;
      },
    });
  }

  function applyDesiredLayer(): void {
    if (destroyed || !styleReady || !canMutateMap()) return;

    if (desiredEntry === null) {
      cancelTransition();
      removeOwnedLayer(fadingLayer);
      removeOwnedLayer(stableLayer);
      fadingLayer = null;
      stableLayer = null;
      removeAllOwnedLayers();
      return;
    }

    if (stableLayer?.entry.id === desiredEntry.id) {
      cancelTransition();
      removeOwnedLayer(fadingLayer);
      fadingLayer = null;
      setLayerOpacity(stableLayer, desiredOpacity);
      fadingOpacity = desiredOpacity;
      return;
    }

    if (fadingLayer?.entry.id === desiredEntry.id) {
      cancelTransition();
      beginFade(fadingLayer, fadingOpacity, desiredOpacity);
      return;
    }

    cancelTransition();
    if (stableLayer === null && fadingLayer !== null) {
      // A first layer can still be entering when a year change arrives. Finalize it as the
      // outgoing layer so the next layer still gets a real crossfade instead of a hard swap.
      finishWithoutAnimation(fadingLayer);
    } else {
      removeOwnedLayer(fadingLayer);
      fadingLayer = null;
    }

    const nextLayer = addLayer(desiredEntry, 0);
    beginFade(nextLayer, 0, desiredOpacity);
  }

  function requestLayer(entry: LayerEntry | null, opacity: number): void {
    desiredEntry = entry;
    desiredOpacity = clampOpacity(opacity);
    applyDesiredLayer();
  }

  function setOpacity(value: number): void {
    desiredOpacity = clampOpacity(value);
    if (destroyed || !styleReady || !canMutateMap()) return;

    // Both layers belong to the same past-layer control while a crossfade is in flight. Keeping
    // the outgoing layer in sync avoids a visible jump if the user changes opacity mid-fade.
    setLayerOpacity(stableLayer, desiredOpacity);
    if (fadingLayer !== null) {
      cancelTransition();
      beginFade(fadingLayer, fadingOpacity, desiredOpacity);
      return;
    }
  }

  function handleStyleReady(): void {
    if (destroyed) return;
    styleReady = true;
    applyDesiredLayer();
  }

  function handleMapError(event: MapErrorLike): void {
    if (!shouldDebug || !isAjaxTileError(event)) return;

    globalThis.console.debug("[chronomap] raster overlay tile error", {
      sourceId: event.sourceId,
      status: (event.error as unknown as { status: number }).status,
      url: (event.error as unknown as { url: string }).url,
    });
  }

  const unsubscribeActiveLayer = store.on(
    (state) => state.timeLayer.activeLayerId,
    (activeLayerId) => {
      requestLayer(
        activeLayerId === null ? null : (entries.get(activeLayerId) ?? null),
        store.get().timeLayer.opacity,
      );
    },
  );
  const unsubscribeOpacity = store.on(
    (state) => state.timeLayer.opacity,
    (opacity) => setOpacity(opacity),
  );

  map.on("load", handleStyleReady);
  map.on("error", handleMapError);

  const initialActiveLayerId = store.get().timeLayer.activeLayerId;
  requestLayer(
    initialActiveLayerId === null ? null : (entries.get(initialActiveLayerId) ?? null),
    store.get().timeLayer.opacity,
  );

  return {
    setLayer: requestLayer,
    setOpacity,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelTransition();
      unsubscribeActiveLayer();
      unsubscribeOpacity();
      map.off("load", handleStyleReady);
      map.off("error", handleMapError);

      if (!isMapRemoved(map)) {
        removeOwnedLayer(fadingLayer);
        removeOwnedLayer(stableLayer);
        removeAllOwnedLayers();
      }
      fadingLayer = null;
      stableLayer = null;
      ownedLayerIds.clear();
      ownedSourceIds.clear();
    },
  };
}

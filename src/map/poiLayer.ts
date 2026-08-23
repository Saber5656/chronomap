import type { Map as MapLibreMap, MapMouseEvent, Source } from "maplibre-gl";

import { latestOnly } from "../providers/poi/wikimediaClient";
import type { Poi, PoiProvider } from "../providers/poi/types";
import { createActions } from "../state/actions";
import { POI_MAX, POI_MIN_ZOOM, type AppState } from "../state/appState";
import type { Store } from "../state/store";
import { haversineMeters, viewportDiagonalMeters } from "../util/geo";
import { poiFeatureId } from "../util/poi";
import { firstLayerIdWithPrefix, USER_LAYER_PREFIX } from "./overlayManager";
import type { MapController } from "./mapController";

export const POI_SOURCE_ID = "chronomap-poi";
export const POI_CIRCLE_LAYER_ID = "chronomap-poi-circle";
export const POI_SYMBOL_LAYER_ID = "chronomap-poi-symbol";
export const POI_ICON_IMAGE_ID = "chronomap-poi-icon";
export const POI_FETCH_DEBOUNCE_MS = 300;
export const POI_PIN_HIT_TOLERANCE_PX = 8;

const POI_ICON_URL = `${import.meta.env.BASE_URL}icons/poi.svg`;

type PoiLocale = AppState["ui"]["lang"];
type PoiCenter = Readonly<{ lat: number; lng: number }>;

export type PoiProviderResolver = PoiProvider | ((locale: PoiLocale) => PoiProvider);

export interface PoiFetchSnapshot {
  readonly center: PoiCenter;
  readonly viewportDiagonalM: number;
  readonly radiusM: number;
  readonly radiusBucket: number;
}

export interface PoiTriggerInput {
  readonly enabled: boolean;
  readonly zoom: number;
  readonly centerMovedM: number;
  readonly viewportDiagonalM: number;
  readonly radiusBucket: number;
  readonly lastFetch: Pick<PoiFetchSnapshot, "radiusBucket"> | null;
  readonly minZoom?: number;
}

/** Return the request radius required by DESIGN §7.1. */
export function calculatePoiRadius(viewportDiagonalM: number): number {
  if (!Number.isFinite(viewportDiagonalM)) return 100;
  return Math.min(10_000, Math.max(100, Math.round(viewportDiagonalM / 2)));
}

/** Return the 500 m cache/politeness bucket used for trigger comparisons. */
export function poiRadiusBucket(radiusM: number): number {
  if (!Number.isFinite(radiusM)) return 0;
  return Math.round(radiusM / 500) * 500;
}

/**
 * Pure map-idle trigger predicate. A first eligible idle always fetches; subsequent idles
 * require a center movement greater than one quarter of the current viewport diagonal or a
 * changed radius bucket. Keeping this function pure makes the request budget truth table easy
 * to audit independently from MapLibre and timers.
 */
export function shouldFetchPoi(input: PoiTriggerInput): boolean {
  const minZoom = input.minZoom ?? POI_MIN_ZOOM;
  if (!input.enabled || !Number.isFinite(input.zoom) || input.zoom < minZoom) return false;
  if (input.lastFetch === null) return true;
  if (input.radiusBucket !== input.lastFetch.radiusBucket) return true;
  if (
    !Number.isFinite(input.centerMovedM) ||
    !Number.isFinite(input.viewportDiagonalM) ||
    input.viewportDiagonalM <= 0
  ) {
    return false;
  }
  return input.centerMovedM > input.viewportDiagonalM * 0.25;
}

type PoiProperties = {
  id: string;
  poiId: string;
  title: string;
};

type PoiGeoJson = GeoJSON.FeatureCollection<GeoJSON.Point, PoiProperties>;

type GeoJsonSourceWithData = Source & {
  type: "geojson";
  setData(data: PoiGeoJson): void | Promise<void>;
};

function isGeoJsonSource(source: Source | undefined): source is GeoJsonSourceWithData {
  return source?.type === "geojson" && "setData" in source && typeof source.setData === "function";
}

function emptyPoiData(): PoiGeoJson {
  return { type: "FeatureCollection", features: [] };
}

function poiData(items: readonly Poi[]): PoiGeoJson {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      id: poiFeatureId(item.id),
      properties: { id: item.id, poiId: item.id, title: item.title },
      geometry: { type: "Point", coordinates: [item.lng, item.lat] },
    })),
  };
}

function sameOptionalNumber(a: number | undefined, b: number | undefined): boolean {
  return a === b || (a === undefined && b === undefined);
}

function samePoi(a: Poi, b: Poi): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    sameOptionalNumber(a.distanceM, b.distanceM) &&
    a.source.provider === b.source.provider &&
    a.source.lang === b.source.lang &&
    a.source.url === b.source.url
  );
}

function samePoiItems(a: readonly Poi[], b: readonly Poi[]): boolean {
  return a.length === b.length && a.every((item, index) => samePoi(item, b[index]!));
}

/** Keep existing ids in their previous order and append newly discovered ids. */
export function stablePoiItems(previous: readonly Poi[], incoming: readonly Poi[]): readonly Poi[] {
  const uniqueIncoming: Poi[] = [];
  const incomingIds = new Set<string>();
  for (const item of incoming.slice(0, POI_MAX)) {
    if (incomingIds.has(item.id)) continue;
    incomingIds.add(item.id);
    uniqueIncoming.push(item);
  }

  const incomingById = new Map(uniqueIncoming.map((item) => [item.id, item] as const));
  const previousIds = new Set<string>();
  const retained = previous.flatMap((item) => {
    if (previousIds.has(item.id) || !incomingIds.has(item.id)) return [];
    previousIds.add(item.id);
    return incomingById.get(item.id) ?? [];
  });
  const additions = uniqueIncoming.filter((item) => !previousIds.has(item.id));
  return [...retained, ...additions].slice(0, POI_MAX);
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("name" in error && (error as { name?: unknown }).name === "AbortError") return true;
  return "kind" in error && (error as { kind?: unknown }).kind === "aborted";
}

interface CombinedSignals {
  readonly signal: AbortSignal;
  cleanup(): void;
}

function combinedSignals(signals: readonly AbortSignal[]): CombinedSignals {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  for (const signal of signals) {
    const abort = (): void => controller.abort(signal.reason);
    if (signal.aborted) {
      abort();
      continue;
    }
    signal.addEventListener("abort", abort, { once: true });
    cleanups.push(() => signal.removeEventListener("abort", abort));
  }

  return {
    signal: controller.signal,
    cleanup() {
      for (const cleanup of cleanups) cleanup();
    },
  };
}

function readFeaturePoiId(feature: { properties?: Record<string, unknown> | null }): string | null {
  const value = feature.properties?.poiId ?? feature.properties?.id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function selectedExpression(): ["boolean", ["feature-state", "selected"], false] {
  return ["boolean", ["feature-state", "selected"], false];
}

function addCircleLayer(map: MapLibreMap, beforeId: string | undefined): void {
  map.addLayer(
    {
      id: POI_CIRCLE_LAYER_ID,
      type: "circle",
      source: POI_SOURCE_ID,
      minzoom: POI_MIN_ZOOM,
      paint: {
        "circle-radius": ["case", selectedExpression(), 10, 6],
        "circle-color": ["case", selectedExpression(), "#d04a2f", "#2d6cdf"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["case", selectedExpression(), 2, 1],
        "circle-opacity": 0.95,
      },
    },
    beforeId,
  );
}

function addSymbolLayer(map: MapLibreMap, beforeId: string | undefined): void {
  map.addLayer(
    {
      id: POI_SYMBOL_LAYER_ID,
      type: "symbol",
      source: POI_SOURCE_ID,
      minzoom: POI_MIN_ZOOM,
      layout: {
        "icon-image": POI_ICON_IMAGE_ID,
        "icon-size": ["case", selectedExpression(), 1.2, 0.9],
        "text-field": ["step", ["zoom"], "", 15, ["get", "title"]],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: {
        "text-color": ["case", selectedExpression(), "#d04a2f", "#17202a"],
        "text-halo-color": "#ffffff",
        "text-halo-width": 1,
      },
    },
    beforeId,
  );
}

function currentMapCenter(map: MapLibreMap): PoiCenter {
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng };
}

function currentSnapshot(mapController: MapController, map: MapLibreMap): PoiFetchSnapshot | null {
  const center = currentMapCenter(map);
  const bbox = mapController.getViewportBbox();
  const diagonal = viewportDiagonalMeters(bbox);
  if (
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    !Number.isFinite(diagonal) ||
    diagonal < 0
  ) {
    return null;
  }
  const radiusM = calculatePoiRadius(diagonal);
  return {
    center,
    viewportDiagonalM: diagonal,
    radiusM,
    radiusBucket: poiRadiusBucket(radiusM),
  };
}

function removeMapLayerIfPresent(map: MapLibreMap, id: string): void {
  try {
    if (map.getLayer(id) !== undefined) map.removeLayer(id);
  } catch {
    /* The map may already be removed during application teardown. */
  }
}

/** Owns the idle-driven POI request policy and the MapLibre POI rendering layers. */
export interface PoiController {
  retry(): void;
  destroy(): void;
}

export function initPoiController(
  mapController: MapController,
  store: Store<AppState>,
  provider: PoiProviderResolver,
): PoiController {
  const map = mapController.getMap();
  const actions = createActions(store);
  const runLatest = latestOnly();
  let destroyed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFetch: PoiFetchSnapshot | null = null;
  let activeRequestController: AbortController | null = null;
  let requestGeneration = 0;
  let latestItems: readonly Poi[] = store.get().poi.items;
  let renderedItems: readonly Poi[] = [];
  let latestData = poiData(latestItems);
  let poiImagePromise: Promise<void> | null = null;
  let poiImageAdded = false;
  let mapReady = typeof map.loaded === "function" ? map.loaded() : styleIsReady();

  function styleIsReady(): boolean {
    try {
      return map.isStyleLoaded() === true;
    } catch {
      return false;
    }
  }

  function clearDebounce(): void {
    if (debounceTimer === null) return;
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  function abortActiveRequest(): void {
    activeRequestController?.abort();
    activeRequestController = null;
  }

  function setEmptyStatus(status: AppState["poi"]["status"]): void {
    const current = store.get().poi;
    if (current.items.length > 0 || current.selectedId !== null) actions.setPoiItems([]);
    if (store.get().poi.status !== status) actions.setPoiStatus(status);
  }

  function invalidate(status: AppState["poi"]["status"]): void {
    clearDebounce();
    requestGeneration += 1;
    lastFetch = null;
    abortActiveRequest();
    setEmptyStatus(status);
  }

  function ensurePoiImage(): void {
    if (poiImageAdded || poiImagePromise !== null) return;

    try {
      if (map.hasImage(POI_ICON_IMAGE_ID)) {
        poiImageAdded = true;
        return;
      }
    } catch {
      return;
    }

    if (typeof Image === "undefined") return;
    poiImagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("POI icon could not be loaded.")), {
        once: true,
      });
      image.src = POI_ICON_URL;
    })
      .then((image) => {
        if (destroyed || !styleIsReady()) return;
        if (!map.hasImage(POI_ICON_IMAGE_ID)) map.addImage(POI_ICON_IMAGE_ID, image);
        poiImageAdded = true;
        ensurePoiLayers(false);
      })
      .catch(() => undefined)
      .finally(() => {
        poiImagePromise = null;
      });
  }

  function applySelectionState(): void {
    if (!styleIsReady() || map.getSource(POI_SOURCE_ID) === undefined) return;
    try {
      map.removeFeatureState({ source: POI_SOURCE_ID });
      const selectedId = store.get().poi.selectedId;
      if (selectedId === null) return;
      const selected = latestItems.find((item) => item.id === selectedId);
      if (selected === undefined) return;
      map.setFeatureState(
        { source: POI_SOURCE_ID, id: poiFeatureId(selected.id) },
        { selected: true },
      );
    } catch {
      /* Feature state can be unavailable while MapLibre is rebuilding source tiles. */
    }
  }

  function ensurePoiLayers(dataChanged: boolean): void {
    if (destroyed || !styleIsReady()) return;
    if (latestItems.length === 0 && map.getSource(POI_SOURCE_ID) === undefined) return;

    const source = map.getSource(POI_SOURCE_ID);
    if (source === undefined) {
      map.addSource(POI_SOURCE_ID, { type: "geojson", data: latestData });
      const addedSource = map.getSource(POI_SOURCE_ID);
      if (isGeoJsonSource(addedSource)) {
        void Promise.resolve(addedSource.setData(latestData)).catch(() => undefined);
      }
    } else if (dataChanged && isGeoJsonSource(source)) {
      void Promise.resolve(source.setData(latestData)).catch(() => undefined);
    }

    const beforeId = firstLayerIdWithPrefix(map, USER_LAYER_PREFIX);
    if (map.getLayer(POI_CIRCLE_LAYER_ID) === undefined) {
      addCircleLayer(map, beforeId);
    }
    ensurePoiImage();
    if (poiImageAdded && map.getLayer(POI_SYMBOL_LAYER_ID) === undefined) {
      addSymbolLayer(map, beforeId);
    }
    map.triggerRepaint();
    applySelectionState();
  }

  function renderItems(items: readonly Poi[]): void {
    const dataChanged = !samePoiItems(renderedItems, items);
    latestItems = items;
    latestData = items.length === 0 ? emptyPoiData() : poiData(items);
    if (dataChanged) renderedItems = [...items];
    ensurePoiLayers(dataChanged);
  }

  function handleStyleReady(): void {
    renderItems(store.get().poi.items);
  }

  function handleMapLoad(): void {
    mapReady = true;
    handleStyleReady();
    handleIdle();
  }

  function poiIdAtPoint(point: { x: number; y: number }): string | null {
    if (!store.get().poi.enabled || map.getZoom() < POI_MIN_ZOOM) return null;
    try {
      const features = map.queryRenderedFeatures(
        [
          [point.x - POI_PIN_HIT_TOLERANCE_PX, point.y - POI_PIN_HIT_TOLERANCE_PX],
          [point.x + POI_PIN_HIT_TOLERANCE_PX, point.y + POI_PIN_HIT_TOLERANCE_PX],
        ],
        { layers: [POI_CIRCLE_LAYER_ID, POI_SYMBOL_LAYER_ID] },
      );
      for (const feature of features) {
        const id = readFeaturePoiId(feature);
        if (id !== null && latestItems.some((item) => item.id === id)) return id;
      }
    } catch {
      /* A click during style/source teardown is treated as a click elsewhere. */
    }

    // MapLibre can briefly have the GeoJSON source in the style graph while its worker
    // tiles are still settling. Keep the pin interaction deterministic during that window
    // by using the projected POI coordinates as a small hit-test fallback.
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const item of latestItems) {
      const projected = map.project([item.lng, item.lat]);
      const dx = projected.x - point.x;
      const dy = projected.y - point.y;
      const distance = dx * dx + dy * dy;
      if (distance <= POI_PIN_HIT_TOLERANCE_PX ** 2 && distance < nearestDistance) {
        nearestId = item.id;
        nearestDistance = distance;
      }
    }
    if (nearestId !== null) return nearestId;
    return null;
  }

  function handleMapClick(event: MapMouseEvent): void {
    if (destroyed) return;
    const id = poiIdAtPoint(event.point);
    if (id === null) {
      actions.selectPoi(null);
      return;
    }
    actions.selectPoi(id);
    actions.openSheet("poi");
  }

  // Store-backed camera changes cover URL/debug/user pans when MapLibre cannot emit a
  // follow-up idle while a GeoJSON source is warming its worker tiles. Transient camera
  // moves such as the private geolocation flight intentionally do not update AppState.view.
  function handleViewChange(): void {
    handleIdle();
  }

  function resolveProvider(locale: PoiLocale): PoiProvider {
    return typeof provider === "function" ? provider(locale) : provider;
  }

  async function fetchPois(snapshot: PoiFetchSnapshot, locale: PoiLocale, generation: number) {
    const localController = new AbortController();
    activeRequestController = localController;
    actions.setPoiStatus("loading");

    try {
      const selectedProvider = resolveProvider(locale);
      const result = await runLatest(async (latestSignal) => {
        const combined = combinedSignals([latestSignal, localController.signal]);
        try {
          return await selectedProvider.search({
            lat: snapshot.center.lat,
            lng: snapshot.center.lng,
            radiusM: snapshot.radiusM,
            locale,
            signal: combined.signal,
          });
        } finally {
          combined.cleanup();
        }
      });

      if (destroyed || generation !== requestGeneration) return;
      const stable = stablePoiItems(store.get().poi.items, result);
      if (!samePoiItems(store.get().poi.items, stable)) actions.setPoiItems(stable);
      actions.setPoiStatus("ready");
    } catch (error: unknown) {
      if (destroyed || generation !== requestGeneration || isAbortError(error)) return;
      actions.setPoiStatus("error");
    } finally {
      if (activeRequestController === localController) activeRequestController = null;
    }
  }

  function beginFetch(snapshot: PoiFetchSnapshot): void {
    debounceTimer = null;
    if (destroyed || !store.get().poi.enabled || map.getZoom() < POI_MIN_ZOOM) return;

    abortActiveRequest();
    requestGeneration += 1;
    const generation = requestGeneration;
    const locale = store.get().ui.lang;
    lastFetch = snapshot;
    void fetchPois(snapshot, locale, generation);
  }

  function handleIdle(): void {
    if (destroyed) return;
    if (!mapReady) return;
    const state = store.get();
    if (!state.poi.enabled) {
      invalidate("idle");
      return;
    }

    const zoom = map.getZoom();
    if (zoom < POI_MIN_ZOOM) {
      invalidate("below-zoom");
      return;
    }

    const snapshot = currentSnapshot(mapController, map);
    if (snapshot === null) return;
    const centerMovedM =
      lastFetch === null ? 0 : haversineMeters(lastFetch.center, snapshot.center);
    if (
      !shouldFetchPoi({
        enabled: state.poi.enabled,
        zoom,
        centerMovedM,
        viewportDiagonalM: snapshot.viewportDiagonalM,
        radiusBucket: snapshot.radiusBucket,
        lastFetch,
      })
    ) {
      return;
    }

    clearDebounce();
    debounceTimer = setTimeout(() => beginFetch(snapshot), POI_FETCH_DEBOUNCE_MS);
  }

  function handleEnabledChange(enabled: boolean): void {
    if (!enabled) {
      invalidate("idle");
      return;
    }
    lastFetch = null;
    if (map.getZoom() < POI_MIN_ZOOM) setEmptyStatus("below-zoom");
    else {
      if (store.get().poi.status !== "idle") actions.setPoiStatus("idle");
      handleIdle();
    }
  }

  function handleLanguageChange(): void {
    const status = store.get().poi.enabled && map.getZoom() < POI_MIN_ZOOM ? "below-zoom" : "idle";
    invalidate(status);
    if (status === "idle") handleIdle();
  }

  const unsubscribeIdle = mapController.onIdle(handleIdle);
  const unsubscribeView = store.on((state) => state.view, handleViewChange);
  const unsubscribeItems = store.on((state) => state.poi.items, renderItems);
  const unsubscribeSelected = store.on(
    (state) => state.poi.selectedId,
    () => applySelectionState(),
  );
  const unsubscribeEnabled = store.on((state) => state.poi.enabled, handleEnabledChange);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, handleLanguageChange);

  map.on("styledata", handleStyleReady);
  map.on("load", handleMapLoad);
  map.on("click", handleMapClick);
  renderItems(latestItems);

  return {
    retry() {
      clearDebounce();
      if (lastFetch !== null) beginFetch(lastFetch);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearDebounce();
      requestGeneration += 1;
      abortActiveRequest();
      unsubscribeIdle();
      unsubscribeView();
      unsubscribeItems();
      unsubscribeSelected();
      unsubscribeEnabled();
      unsubscribeLanguage();
      map.off("styledata", handleStyleReady);
      map.off("load", handleMapLoad);
      map.off("click", handleMapClick);

      if (styleIsReady()) {
        removeMapLayerIfPresent(map, POI_SYMBOL_LAYER_ID);
        removeMapLayerIfPresent(map, POI_CIRCLE_LAYER_ID);
        try {
          if (map.getSource(POI_SOURCE_ID) !== undefined) map.removeSource(POI_SOURCE_ID);
          if (poiImageAdded && map.hasImage(POI_ICON_IMAGE_ID)) map.removeImage(POI_ICON_IMAGE_ID);
        } catch {
          /* The map can be removed before its final controller is destroyed. */
        }
      }
    },
  };
}

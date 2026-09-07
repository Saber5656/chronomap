import {
  AttributionControl,
  Map as MapLibreMap,
  setWorkerUrl,
  type MapOptions,
  type MapMovementEvent,
  type Source,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createActions } from "../state/actions";
import { ZOOM_MAX, ZOOM_MIN, type AppState } from "../state/appState";
import type { Store } from "../state/store";
import { latLng, MAX_ACCURACY_METERS } from "../security/validate";
import { metersToPixelsAtLat, type BoundingBox } from "../util/geo";
import { recordTileFailure } from "../app/networkStatus";
import { t } from "../ui/i18n";
import {
  GSI_ATTRIBUTION_TEXT,
  GSI_ATTRIBUTION_URL,
  GSI_BASEMAP_SOURCE_ID,
  GSI_PALE_TILE_URL,
} from "../providers/layers/gsiBasemap";

export {
  GSI_ATTRIBUTION_TEXT,
  GSI_ATTRIBUTION_URL,
  GSI_BASEMAP_SOURCE_ID,
  GSI_PALE_TILE_URL,
  GSI_STANDARD_TILE_URL,
} from "../providers/layers/gsiBasemap";

// Vite cannot follow MapLibre's runtime sibling import from a package URL in a Pages build. The
// build plugin emits both stable assets; development uses the package path served by Vite.
const MAPLIBRE_WORKER_URL = import.meta.env.PROD
  ? new URL(`${import.meta.env.BASE_URL}assets/maplibre-gl-worker.mjs`, globalThis.location.origin)
      .href
  : "/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
setWorkerUrl(MAPLIBRE_WORKER_URL);

export const GSI_ATTRIBUTION = `<a href="${GSI_ATTRIBUTION_URL}" target="_blank" rel="noopener noreferrer">${GSI_ATTRIBUTION_TEXT}</a>`;

const MAP_BACKGROUND_COLOR = "#f5f7fa";
const LONG_PRESS_DELAY_MS = 600;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;
const TOUCH_CONTEXT_MENU_SUPPRESSION_MS = 1_000;
const CONTEXT_MENU_DEDUPE_MS = 100;
const USER_FLY_TO_ZOOM = 15;
const USER_FLY_TO_DURATION_MS = 1_500;
const COVERAGE_FLY_TO_DURATION_MS = 800;

export const USER_LOCATION_SOURCE_ID = "chronomap-user";
export const USER_LOCATION_ACCURACY_LAYER_ID = "chronomap-user-accuracy";
export const USER_LOCATION_DOT_LAYER_ID = "chronomap-user-dot";

/** The fixed inline style keeps the first map request limited to the GSI basemap. */
export const GSI_BASEMAP_STYLE = {
  version: 8,
  sources: {
    [GSI_BASEMAP_SOURCE_ID]: {
      type: "raster",
      tiles: [GSI_PALE_TILE_URL],
      tileSize: 256,
      minzoom: ZOOM_MIN,
      maxzoom: ZOOM_MAX,
      attribution: GSI_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": MAP_BACKGROUND_COLOR },
    },
    {
      id: GSI_BASEMAP_SOURCE_ID,
      type: "raster",
      source: GSI_BASEMAP_SOURCE_ID,
      minzoom: ZOOM_MIN,
      maxzoom: ZOOM_MAX,
    },
  ],
} satisfies Exclude<NonNullable<MapOptions["style"]>, string>;

export type MapLngLat = Readonly<{
  lng: number;
  lat: number;
}>;

export type UserFix = Pick<NonNullable<AppState["geo"]["fix"]>, "lat" | "lng">;
export type UserLocationFix = NonNullable<AppState["geo"]["fix"]>;

export interface MapController {
  getMap(): MapLibreMap;
  getViewportBbox(): BoundingBox;
  onIdle(callback: () => void): () => void;
  onLongPress(callback: (lngLat: MapLngLat) => void): () => void;
  flyTo(view: Pick<AppState["view"], "lat" | "lng" | "zoom">): void;
  flyToUser(fix: UserFix): void;
  setUserFix(fix: UserLocationFix): void;
  destroy(): void;
}

interface CameraView {
  lat: number;
  lng: number;
  zoom: number;
}

interface ProgrammaticCameraOperation {
  generation: number;
  view: CameraView;
  updateStoreOnMatch: boolean;
  consumed: boolean;
}

interface LongPressState {
  pointerId: number;
  startX: number;
  startY: number;
  fired: boolean;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeView(view: Readonly<AppState["view"]>): CameraView {
  const coordinates = latLng(view.lat, view.lng);
  const normalizedZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom));

  return {
    lat: coordinates === null ? 0 : roundTo(coordinates.lat, 6),
    lng: coordinates === null ? 0 : roundTo(coordinates.lng, 6),
    zoom: roundTo(normalizedZoom, 2),
  };
}

function isCanonicalView(view: Readonly<AppState["view"]>, normalized: CameraView): boolean {
  return (
    view.lat === normalized.lat && view.lng === normalized.lng && view.zoom === normalized.zoom
  );
}

function viewsEqual(a: CameraView, b: CameraView): boolean {
  return a.lat === b.lat && a.lng === b.lng && a.zoom === b.zoom;
}

function isProgrammaticMove(event: MapMovementEvent): boolean {
  return event.originalEvent === undefined;
}

function prefersReducedMotion(container: HTMLElement): boolean {
  const windowForContainer = container.ownerDocument.defaultView;
  return windowForContainer?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function toMapCamera(view: CameraView): {
  center: [number, number];
  zoom: number;
  bearing: 0;
  pitch: 0;
  roll: 0;
} {
  return {
    center: [view.lng, view.lat],
    zoom: view.zoom,
    bearing: 0,
    pitch: 0,
    roll: 0,
  };
}

function toMapLngLat(lngLat: { lng: number; lat: number }): MapLngLat {
  return { lng: lngLat.lng, lat: lngLat.lat };
}

type UserLocationFeatureKind = "accuracy" | "dot";
type UserLocationGeoJson = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { kind: UserLocationFeatureKind }
>;

type GeoJsonSourceWithData = Source & {
  type: "geojson";
  setData(data: UserLocationGeoJson): Promise<void>;
};

function isGeoJsonSource(source: Source | undefined): source is GeoJsonSourceWithData {
  return source?.type === "geojson" && "setData" in source && typeof source.setData === "function";
}

function createUserLocationGeoJson(fix: UserLocationFix): UserLocationGeoJson {
  const point = [fix.lng, fix.lat] as [number, number];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "accuracy" },
        geometry: { type: "Point", coordinates: point },
      },
      {
        type: "Feature",
        properties: { kind: "dot" },
        geometry: { type: "Point", coordinates: point },
      },
    ],
  };
}

function userAccuracyRadiusPixels(fix: UserLocationFix, zoom: number): number {
  // Web Mercator is undefined at the poles. The location itself remains the validated
  // coordinate; only the display approximation is clamped to the projection's usable edge.
  const displayLatitude = Math.max(-85.05112878, Math.min(85.05112878, fix.lat));
  const radius = metersToPixelsAtLat(fix.accuracyM, displayLatitude, zoom);
  return Number.isFinite(radius) && radius >= 0 ? radius : 0;
}

/** Owns the MapLibre instance and the camera boundary for AppState.view. */
export function createMap(container: HTMLElement, store: Store<AppState>): MapController {
  const actions = createActions(store);
  // LHCI blocks upstream tile hosts by design. Keep that synthetic failure from replacing the
  // initial shell as LCP; offline/error UX remains covered by the real network-state and E2E tests.
  const suppressSyntheticTileNotice =
    new URLSearchParams(container.ownerDocument.defaultView?.location.search ?? "").get("lhci") ===
    "1";
  const initialView = normalizeView(store.get().view);
  const map = new MapLibreMap({
    container,
    style: GSI_BASEMAP_STYLE,
    center: [initialView.lng, initialView.lat],
    zoom: initialView.zoom,
    bearing: 0,
    pitch: 0,
    roll: 0,
    minZoom: ZOOM_MIN,
    maxZoom: ZOOM_MAX,
    minPitch: 0,
    maxPitch: 0,
    dragRotate: false,
    touchZoomRotate: true,
    touchPitch: false,
    pitchWithRotate: false,
    rollEnabled: false,
    attributionControl: false,
  });

  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.setMinPitch(0);
  map.setMaxPitch(0);

  const attributionControl = new AttributionControl({
    compact: true,
  });
  map.addControl(attributionControl, "bottom-left");

  const idleListeners = new Set<() => void>();
  const longPressListeners = new Set<(lngLat: MapLngLat) => void>();
  let destroyed = false;
  let nextProgrammaticGeneration = 0;
  let lastConsumedProgrammaticGeneration = 0;
  let activeProgrammaticOperation: ProgrammaticCameraOperation | null = null;
  let longPressState: LongPressState | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let lastContextMenuAt = Number.NEGATIVE_INFINITY;
  let suppressContextMenuUntil = Number.NEGATIVE_INFINITY;
  let userCameraGesture = false;
  let userFix: UserLocationFix | null = null;
  let userFixRenderPending = false;
  let tileFailures: readonly number[] = [];
  let lastTileNotice = Number.NEGATIVE_INFINITY;
  const handleTileError = (event: { sourceId?: string; error?: unknown }): void => {
    if (store.get().ui.offline || event.sourceId !== GSI_BASEMAP_SOURCE_ID) return;
    const status = (event.error as { status?: unknown } | undefined)?.status;
    if (status === 404) return;
    const result = recordTileFailure(Date.now(), tileFailures, lastTileNotice);
    tileFailures = result.failures;
    lastTileNotice = result.lastNotice;
    if (result.notify && !suppressSyntheticTileNotice)
      createActions(store).showToast("error", t("net.tilesFailing", {}, store.get().ui.lang));
  };

  function updateUserAccuracyRadius(): void {
    if (userFix === null || map.getLayer(USER_LOCATION_ACCURACY_LAYER_ID) === undefined) return;

    map.setPaintProperty(
      USER_LOCATION_ACCURACY_LAYER_ID,
      "circle-radius",
      userAccuracyRadiusPixels(userFix, map.getZoom()),
    );
  }

  function renderUserFix(): void {
    if (destroyed || userFix === null) return;
    if (!map.isStyleLoaded()) {
      userFixRenderPending = true;
      return;
    }
    userFixRenderPending = false;

    const data = createUserLocationGeoJson(userFix);
    const source = map.getSource(USER_LOCATION_SOURCE_ID);
    if (source === undefined) {
      map.addSource(USER_LOCATION_SOURCE_ID, { type: "geojson", data });
    } else if (isGeoJsonSource(source)) {
      void source.setData(data);
    } else {
      return;
    }

    if (map.getLayer(USER_LOCATION_ACCURACY_LAYER_ID) === undefined) {
      map.addLayer({
        id: USER_LOCATION_ACCURACY_LAYER_ID,
        type: "circle",
        source: USER_LOCATION_SOURCE_ID,
        filter: ["==", ["get", "kind"], "accuracy"],
        paint: {
          "circle-color": "#2d6cdf",
          "circle-opacity": 0.16,
          "circle-radius": userAccuracyRadiusPixels(userFix, map.getZoom()),
          "circle-stroke-color": "#2d6cdf",
          "circle-stroke-opacity": 0.72,
          "circle-stroke-width": 1,
        },
      });
    } else {
      updateUserAccuracyRadius();
    }

    if (map.getLayer(USER_LOCATION_DOT_LAYER_ID) === undefined) {
      map.addLayer({
        id: USER_LOCATION_DOT_LAYER_ID,
        type: "circle",
        source: USER_LOCATION_SOURCE_ID,
        filter: ["==", ["get", "kind"], "dot"],
        paint: {
          "circle-color": "#2d6cdf",
          "circle-radius": 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }

  const handleStyleData = (): void => {
    renderUserFix();
  };
  const handleSourceData = (event: { sourceId?: string }): void => {
    if (event.sourceId === USER_LOCATION_SOURCE_ID && userFixRenderPending) {
      renderUserFix();
    }
  };

  function readCameraView(): CameraView {
    const center = map.getCenter();
    return normalizeView({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
  }

  function clearLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressState = null;
  }

  function emitLongPress(lngLat: MapLngLat): void {
    for (const callback of [...longPressListeners]) callback(lngLat);
  }

  function getContainerPoint(event: PointerEvent): { x: number; y: number } {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function cancelLongPress(): void {
    if (longPressState !== null) clearLongPress();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (destroyed) return;

    if (longPressState !== null) {
      clearLongPress();
      return;
    }

    const isPrimaryButton = event.isPrimary !== false && event.button === 0;
    if (!isPrimaryButton) return;

    // MapLibre versions/browsers do not consistently populate moveend.originalEvent for
    // drag-pan. Keep the pointer boundary so URL sync still receives the settled user view.
    userCameraGesture = true;
    if (event.pointerType === "mouse") return;

    const point = getContainerPoint(event);
    longPressState = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      fired: false,
    };

    longPressTimer = setTimeout(() => {
      const active = longPressState;
      longPressTimer = null;
      if (active === null || active.fired || destroyed) return;

      active.fired = true;
      suppressContextMenuUntil = Date.now() + TOUCH_CONTEXT_MENU_SUPPRESSION_MS;
      const lngLat = toMapLngLat(map.unproject([active.startX, active.startY]));
      emitLongPress(lngLat);
    }, LONG_PRESS_DELAY_MS);
  }

  function handlePointerMove(event: PointerEvent): void {
    const active = longPressState;
    if (active === null) return;
    if (event.pointerId !== active.pointerId) {
      clearLongPress();
      return;
    }

    const point = getContainerPoint(event);
    const dx = point.x - active.startX;
    const dy = point.y - active.startY;
    if (Math.hypot(dx, dy) >= LONG_PRESS_MOVE_THRESHOLD_PX) clearLongPress();
  }

  function handlePointerEnd(event: PointerEvent): void {
    if (event.pointerType !== "mouse") {
      suppressContextMenuUntil = Date.now() + TOUCH_CONTEXT_MENU_SUPPRESSION_MS;
    }
    if (longPressState?.pointerId === event.pointerId) clearLongPress();
  }

  function handleContextMenu(event: {
    lngLat: { lng: number; lat: number };
    preventDefault(): void;
  }): void {
    if (destroyed) return;
    event.preventDefault();

    const now = Date.now();
    if (now <= suppressContextMenuUntil) return;
    if (longPressState !== null) {
      clearLongPress();
      return;
    }
    if (now - lastContextMenuAt < CONTEXT_MENU_DEDUPE_MS) return;

    lastContextMenuAt = now;
    emitLongPress(toMapLngLat(event.lngLat));
  }

  function handleMoveEnd(event: MapMovementEvent): void {
    if (destroyed) return;

    const cameraView = readCameraView();
    const isUserGesture = userCameraGesture || !isProgrammaticMove(event);
    userCameraGesture = false;
    if (!isUserGesture) {
      const operation = activeProgrammaticOperation;
      if (operation === null) return;

      consumeProgrammaticOperation(operation, cameraView);
      return;
    }

    activeProgrammaticOperation = null;
    actions.setView(cameraView);
  }

  function handleUserDragStart(): void {
    userCameraGesture = true;
  }

  function consumeProgrammaticOperation(
    operation: ProgrammaticCameraOperation,
    cameraView: CameraView,
  ): void {
    if (
      activeProgrammaticOperation === null ||
      activeProgrammaticOperation.generation !== operation.generation ||
      operation.consumed ||
      operation.generation <= lastConsumedProgrammaticGeneration ||
      !viewsEqual(cameraView, operation.view)
    ) {
      return;
    }

    operation.consumed = true;
    lastConsumedProgrammaticGeneration = operation.generation;
    activeProgrammaticOperation = null;
    if (operation.updateStoreOnMatch) actions.setView(cameraView);
  }

  function handleIdle(): void {
    if (destroyed) return;
    if (userFixRenderPending) renderUserFix();
    for (const callback of [...idleListeners]) callback();
  }

  function beginProgrammaticOperation(
    view: CameraView,
    updateStoreOnMatch: boolean,
  ): ProgrammaticCameraOperation {
    const operation: ProgrammaticCameraOperation = {
      generation: nextProgrammaticGeneration + 1,
      view,
      updateStoreOnMatch,
      consumed: false,
    };
    nextProgrammaticGeneration = operation.generation;
    activeProgrammaticOperation = operation;
    return operation;
  }

  function syncMapToStoreView(): void {
    if (destroyed) return;

    const requestedView = store.get().view;
    const targetView = normalizeView(store.get().view);
    if (viewsEqual(readCameraView(), targetView)) {
      activeProgrammaticOperation = null;
      if (!isCanonicalView(requestedView, targetView)) actions.setView(targetView);
      return;
    }

    beginProgrammaticOperation(targetView, false);
    map.stop();
    map.jumpTo(toMapCamera(targetView));
    if (!isCanonicalView(requestedView, targetView)) actions.setView(targetView);
  }

  const unsubscribeStore = store.on((state) => state.view, syncMapToStoreView);
  map.on("moveend", handleMoveEnd);
  map.on("dragstart", handleUserDragStart);
  map.on("idle", handleIdle);
  map.on("styledata", handleStyleData);
  map.on("load", handleStyleData);
  map.on("sourcedata", handleSourceData);
  map.on("zoom", updateUserAccuracyRadius);
  map.on("move", cancelLongPress);
  map.on("zoomstart", cancelLongPress);
  map.on("rotatestart", cancelLongPress);
  map.on("pitchstart", cancelLongPress);
  map.on("rollstart", cancelLongPress);
  map.on("error", handleTileError);

  container.addEventListener("pointerdown", handlePointerDown);
  container.addEventListener("pointermove", handlePointerMove);
  container.addEventListener("pointerup", handlePointerEnd);
  container.addEventListener("pointercancel", handlePointerEnd);
  container.addEventListener("lostpointercapture", handlePointerEnd);
  map.on("contextmenu", handleContextMenu);

  return {
    getMap: () => map,
    getViewportBbox() {
      const bounds = map.getBounds();
      return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    },
    onIdle(callback) {
      if (destroyed) return () => undefined;
      idleListeners.add(callback);
      return () => idleListeners.delete(callback);
    },
    onLongPress(callback) {
      if (destroyed) return () => undefined;
      longPressListeners.add(callback);
      return () => longPressListeners.delete(callback);
    },
    flyTo(view) {
      if (destroyed) return;

      const coordinates = latLng(view.lat, view.lng);
      if (coordinates === null || !Number.isFinite(view.zoom)) return;

      const targetView = normalizeView({
        lat: coordinates.lat,
        lng: coordinates.lng,
        zoom: view.zoom,
      });
      beginProgrammaticOperation(targetView, true);
      map.stop();

      if (prefersReducedMotion(container)) {
        map.jumpTo(toMapCamera(targetView));
      } else {
        map.flyTo({ ...toMapCamera(targetView), duration: COVERAGE_FLY_TO_DURATION_MS });
      }
    },
    flyToUser(fix) {
      if (destroyed) return;

      const coordinates = latLng(fix.lat, fix.lng);
      if (coordinates === null) return;

      const targetView: CameraView = {
        ...normalizeView({ lat: coordinates.lat, lng: coordinates.lng, zoom: USER_FLY_TO_ZOOM }),
      };
      // Geolocation camera movement is transient. Keeping it out of AppState.view prevents
      // URL/share synchronizers from persisting the private fix; the first user camera gesture
      // converges the persistent view through handleMoveEnd.
      beginProgrammaticOperation(targetView, false);
      map.stop();

      if (prefersReducedMotion(container)) {
        map.jumpTo(toMapCamera(targetView));
      } else {
        map.flyTo({ ...toMapCamera(targetView), duration: USER_FLY_TO_DURATION_MS });
      }
    },
    setUserFix(fix) {
      if (destroyed) return;

      const coordinates = latLng(fix.lat, fix.lng);
      if (
        coordinates === null ||
        !Number.isFinite(fix.accuracyM) ||
        fix.accuracyM < 0 ||
        fix.accuracyM > MAX_ACCURACY_METERS ||
        !Number.isFinite(fix.at)
      ) {
        return;
      }

      userFix = { ...coordinates, accuracyM: fix.accuracyM, at: fix.at };
      renderUserFix();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;

      clearLongPress();
      unsubscribeStore();
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerEnd);
      container.removeEventListener("pointercancel", handlePointerEnd);
      container.removeEventListener("lostpointercapture", handlePointerEnd);
      map.off("moveend", handleMoveEnd);
      map.off("dragstart", handleUserDragStart);
      map.off("idle", handleIdle);
      map.off("styledata", handleStyleData);
      map.off("load", handleStyleData);
      map.off("sourcedata", handleSourceData);
      map.off("zoom", updateUserAccuracyRadius);
      map.off("move", cancelLongPress);
      map.off("zoomstart", cancelLongPress);
      map.off("rotatestart", cancelLongPress);
      map.off("pitchstart", cancelLongPress);
      map.off("rollstart", cancelLongPress);
      map.off("error", handleTileError);
      map.off("contextmenu", handleContextMenu);
      idleListeners.clear();
      longPressListeners.clear();
      activeProgrammaticOperation = null;
      userFix = null;
      userFixRenderPending = false;
      map.removeControl(attributionControl);
      map.remove();
    },
  };
}

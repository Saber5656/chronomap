import {
  AttributionControl,
  Map as MapLibreMap,
  type MapOptions,
  type MapMovementEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createActions } from "../state/actions";
import { ZOOM_MAX, ZOOM_MIN, type AppState } from "../state/appState";
import type { Store } from "../state/store";
import { latLng } from "../security/validate";
import type { BoundingBox } from "../util/geo";

export const GSI_PALE_TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
export const GSI_STANDARD_TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
export const GSI_ATTRIBUTION_URL = "https://maps.gsi.go.jp/development/ichiran.html";
export const GSI_ATTRIBUTION = `<a href="${GSI_ATTRIBUTION_URL}" target="_blank" rel="noopener noreferrer">地理院タイル（国土地理院）</a>`;
export const GSI_BASEMAP_SOURCE_ID = "gsi-pale";

const MAP_BACKGROUND_COLOR = "#f5f7fa";
const LONG_PRESS_DELAY_MS = 600;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;
const TOUCH_CONTEXT_MENU_SUPPRESSION_MS = 1_000;
const CONTEXT_MENU_DEDUPE_MS = 100;
const USER_FLY_TO_ZOOM = 15;
const USER_FLY_TO_DURATION_MS = 1_500;

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

export interface MapController {
  getMap(): MapLibreMap;
  getViewportBbox(): BoundingBox;
  onIdle(callback: () => void): () => void;
  onLongPress(callback: (lngLat: MapLngLat) => void): () => void;
  flyToUser(fix: UserFix): void;
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

/** Owns the MapLibre instance and the camera boundary for AppState.view. */
export function createMap(container: HTMLElement, store: Store<AppState>): MapController {
  const actions = createActions(store);
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
    if (!isPrimaryButton || event.pointerType === "mouse") return;

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
    if (isProgrammaticMove(event)) {
      const operation = activeProgrammaticOperation;
      if (operation === null) return;

      consumeProgrammaticOperation(operation, cameraView);
      return;
    }

    activeProgrammaticOperation = null;
    actions.setView(cameraView);
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
  map.on("idle", handleIdle);
  map.on("move", cancelLongPress);
  map.on("zoomstart", cancelLongPress);
  map.on("rotatestart", cancelLongPress);
  map.on("pitchstart", cancelLongPress);
  map.on("rollstart", cancelLongPress);

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
    flyToUser(fix) {
      if (destroyed) return;

      const coordinates = latLng(fix.lat, fix.lng);
      if (coordinates === null) return;

      const targetView: CameraView = {
        ...normalizeView({ lat: coordinates.lat, lng: coordinates.lng, zoom: USER_FLY_TO_ZOOM }),
      };
      beginProgrammaticOperation(targetView, true);
      map.stop();

      if (prefersReducedMotion(container)) {
        map.jumpTo(toMapCamera(targetView));
      } else {
        map.flyTo({ ...toMapCamera(targetView), duration: USER_FLY_TO_DURATION_MS });
      }
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
      map.off("idle", handleIdle);
      map.off("move", cancelLongPress);
      map.off("zoomstart", cancelLongPress);
      map.off("rotatestart", cancelLongPress);
      map.off("pitchstart", cancelLongPress);
      map.off("rollstart", cancelLongPress);
      map.off("contextmenu", handleContextMenu);
      idleListeners.clear();
      longPressListeners.clear();
      activeProgrammaticOperation = null;
      map.removeControl(attributionControl);
      map.remove();
    },
  };
}

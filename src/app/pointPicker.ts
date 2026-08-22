import type { Map as MapLibreMap, Source } from "maplibre-gl";

import { latLng } from "../security/validate";
import { createActions } from "../state/actions";
import type { AppState } from "../state/appState";
import type { Store } from "../state/store";
import type { MapController, MapLngLat } from "../map/mapController";
import {
  showMapHandoffMenu,
  type MapHandoffMenuController,
  type MapHandoffMenuOptions,
} from "../ui/components/MapHandoffMenu";
import { onLangChange, t, type I18nKey } from "../ui/i18n";
import { el } from "../util/dom";

export const PICKED_POINT_SOURCE_ID = "chronomap-picked";
export const PICKED_POINT_LAYER_ID = "chronomap-picked-marker";

const POPOVER_GAP_PX = 12;
const POPOVER_MARGIN_PX = 12;
const MAP_CHROME_BOTTOM_PX = 96;
const FALLBACK_POPOVER_SIZE = { width: 240, height: 160 } as const;
const MAP_SAFE_AREA = {
  top: POPOVER_MARGIN_PX,
  right: POPOVER_MARGIN_PX,
  bottom: MAP_CHROME_BOTTOM_PX + POPOVER_MARGIN_PX,
  left: POPOVER_MARGIN_PX,
} as const;
const MAP_CLICK_SUPPRESSION_MS = 500;

export type PickerPoint = Readonly<{
  lat: number;
  lng: number;
}>;

export type ScreenPoint = Readonly<{
  x: number;
  y: number;
}>;

export type BoxSize = Readonly<{
  width: number;
  height: number;
}>;

export type SafeAreaInsets = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

export type PopoverSide = "above" | "below";

export interface PopoverPlacement {
  readonly left: number;
  readonly top: number;
  readonly side: PopoverSide;
}

/**
 * Place a popover beside an anchor while keeping it inside the supplied safe area.
 * The helper is deliberately DOM-free so edge-flip behaviour can be tested deterministically.
 */
export function calculatePopoverPlacement(
  anchor: ScreenPoint,
  popover: BoxSize,
  viewport: BoxSize,
  safeArea: SafeAreaInsets = {
    top: POPOVER_MARGIN_PX,
    right: POPOVER_MARGIN_PX,
    bottom: POPOVER_MARGIN_PX,
    left: POPOVER_MARGIN_PX,
  },
  gap = POPOVER_GAP_PX,
): PopoverPlacement {
  const width = Math.max(0, popover.width);
  const height = Math.max(0, popover.height);
  const minLeft = Math.max(0, safeArea.left);
  const maxLeft = Math.max(minLeft, viewport.width - Math.max(0, safeArea.right) - width);
  const left = clamp(anchor.x - width / 2, minLeft, maxLeft);

  const minTop = Math.max(0, safeArea.top);
  const maxTop = Math.max(minTop, viewport.height - Math.max(0, safeArea.bottom) - height);
  const belowTop = anchor.y + gap;
  const aboveTop = anchor.y - gap - height;
  const canPlaceBelow = belowTop <= maxTop;
  const canPlaceAbove = aboveTop >= minTop;
  const side: PopoverSide = canPlaceBelow
    ? "below"
    : canPlaceAbove
      ? "above"
      : anchor.y <= viewport.height / 2
        ? "below"
        : "above";
  const preferredTop = side === "below" ? belowTop : aboveTop;

  return {
    left,
    top: clamp(preferredTop, minTop, maxTop),
    side,
  };
}

/** Alias with a name that describes the component-specific use at call sites. */
export const placePointPickerPopover = calculatePopoverPlacement;

export function formatPickedCoordinates(point: PickerPoint): string {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

export interface PointPickerOptions {
  readonly showHandoffMenu?: (
    lat: number,
    lng: number,
    options?: MapHandoffMenuOptions,
  ) => MapHandoffMenuController;
}

export interface PointPickerController {
  getPickedPoint(): PickerPoint | null;
  destroy(): void;
}

type PickerAction = "travelHere" | "openInMaps" | "copyCoords";
type PickedPointGeoJson = GeoJSON.FeatureCollection<GeoJSON.Point, { kind: "picked" }>;
type GeoJsonSourceWithData = Source & {
  type: "geojson";
  setData(data: PickedPointGeoJson): void | Promise<void>;
};

const ACTION_LABELS: Record<PickerAction, I18nKey> = {
  travelHere: "picker.travelHere",
  openInMaps: "picker.openInMaps",
  copyCoords: "picker.copyCoords",
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isGeoJsonSource(source: Source | undefined): source is GeoJsonSourceWithData {
  return source?.type === "geojson" && "setData" in source && typeof source.setData === "function";
}

function emptyPickedPointData(): PickedPointGeoJson {
  return { type: "FeatureCollection", features: [] };
}

function pickedPointData(point: PickerPoint | null): PickedPointGeoJson {
  if (point === null) return emptyPickedPointData();

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "picked" },
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      },
    ],
  };
}

function eventHasOriginalEvent(event: unknown): boolean {
  if (typeof event !== "object" || event === null || !("originalEvent" in event)) return false;
  return (event as { originalEvent?: unknown }).originalEvent !== undefined;
}

function cameraMatches(map: MapLibreMap, target: PickerPoint & { zoom: number }): boolean {
  const center = map.getCenter();
  return (
    Math.abs(center.lat - target.lat) < 0.000001 &&
    Math.abs(center.lng - target.lng) < 0.000001 &&
    Math.abs(map.getZoom() - target.zoom) < 0.01
  );
}

function noOpPointPicker(): PointPickerController {
  return {
    getPickedPoint: () => null,
    destroy: () => undefined,
  };
}

/** Mount the ephemeral long-press point picker on the map region. */
export function mountPointPicker(
  parent: HTMLElement,
  store: Store<AppState>,
  mapController: MapController,
  options: PointPickerOptions = {},
): PointPickerController {
  // Keep the bootstrap test double and degraded shells harmless while the production contract
  // remains MapController.getMap()/onLongPress().
  const controllerShape = mapController as Partial<MapController>;
  if (
    typeof controllerShape.getMap !== "function" ||
    typeof controllerShape.onLongPress !== "function"
  ) {
    return noOpPointPicker();
  }

  const map = controllerShape.getMap();
  const actions = createActions(store);
  const openHandoffMenu = options.showHandoffMenu ?? showMapHandoffMenu;
  let destroyed = false;
  let pickedPoint: PickerPoint | null = null;
  let popover: HTMLElement | null = null;
  let unsubscribePopoverLanguage: (() => void) | undefined;
  let handoffMenu: MapHandoffMenuController | undefined;
  let programmaticPickerRecenter: (PickerPoint & { zoom: number }) | null = null;
  let suppressMapClickUntil = Number.NEGATIVE_INFINITY;

  function renderPickedPoint(): void {
    if (destroyed || !map.isStyleLoaded()) return;
    if (pickedPoint === null) {
      removePickedPointLayers();
      return;
    }

    const data = pickedPointData(pickedPoint);
    const source = map.getSource(PICKED_POINT_SOURCE_ID);
    if (source === undefined) {
      map.addSource(PICKED_POINT_SOURCE_ID, { type: "geojson", data });
    } else if (isGeoJsonSource(source)) {
      void source.setData(data);
    } else {
      return;
    }

    if (map.getLayer(PICKED_POINT_LAYER_ID) === undefined) {
      map.addLayer({
        id: PICKED_POINT_LAYER_ID,
        type: "circle",
        source: PICKED_POINT_SOURCE_ID,
        paint: {
          "circle-color": "rgba(255, 255, 255, 0)",
          "circle-radius": 10,
          "circle-stroke-color": "#d04a2f",
          "circle-stroke-width": 3,
          "circle-stroke-opacity": 1,
        },
      });
    }
  }

  function removePickedPointLayers(): void {
    if (!map.isStyleLoaded()) return;
    if (map.getLayer(PICKED_POINT_LAYER_ID) !== undefined) {
      map.removeLayer(PICKED_POINT_LAYER_ID);
    }
    if (map.getSource(PICKED_POINT_SOURCE_ID) !== undefined) {
      map.removeSource(PICKED_POINT_SOURCE_ID);
    }
  }

  function destroyPopover(): void {
    unsubscribePopoverLanguage?.();
    unsubscribePopoverLanguage = undefined;
    popover?.remove();
    popover = null;
  }

  function dismissPickedPoint(): void {
    if (pickedPoint === null && popover === null) return;
    programmaticPickerRecenter = null;
    pickedPoint = null;
    destroyPopover();
    renderPickedPoint();
  }

  function viewportSize(): BoxSize {
    const parentRect = parent.getBoundingClientRect();
    const width = parent.clientWidth || parentRect.width || window.innerWidth;
    const height = parent.clientHeight || parentRect.height || window.innerHeight;
    return { width, height };
  }

  function anchorInParent(point: PickerPoint): ScreenPoint {
    const projected = map.project({ lng: point.lng, lat: point.lat });
    const mapRect = map.getContainer().getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      x: mapRect.left - parentRect.left + projected.x,
      y: mapRect.top - parentRect.top + projected.y,
    };
  }

  function renderPopoverPosition(): void {
    if (popover === null || pickedPoint === null) return;

    const rect = popover.getBoundingClientRect();
    const size = {
      width: rect.width || FALLBACK_POPOVER_SIZE.width,
      height: rect.height || FALLBACK_POPOVER_SIZE.height,
    };
    const placement = calculatePopoverPlacement(
      anchorInParent(pickedPoint),
      size,
      viewportSize(),
      MAP_SAFE_AREA,
    );
    popover.style.left = `${placement.left}px`;
    popover.style.top = `${placement.top}px`;
    popover.dataset.placement = placement.side;
  }

  function locale(): AppState["ui"]["lang"] {
    return store.get().ui.lang;
  }

  function renderPopoverLabels(buttons: ReadonlyMap<PickerAction, HTMLButtonElement>): void {
    const currentLocale = locale();
    for (const [action, button] of buttons) {
      const label = t(ACTION_LABELS[action], {}, currentLocale);
      button.textContent = label;
      button.setAttribute("aria-label", label);
    }
  }

  function writeClipboard(value: string): Promise<void> {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (clipboard === undefined) return Promise.reject(new Error("Clipboard API unavailable."));
    return clipboard.writeText(value);
  }

  function openHandoff(point: PickerPoint): void {
    handoffMenu?.destroy();
    handoffMenu = openHandoffMenu(point.lat, point.lng, {
      parent,
      store,
      zoom: Math.round(map.getZoom()),
      onClose: () => {
        handoffMenu = undefined;
      },
    });
  }

  function handleAction(action: PickerAction): void {
    if (pickedPoint === null) return;
    const point = pickedPoint;

    if (action === "travelHere") {
      const target = {
        ...point,
        zoom: Math.max(store.get().view.zoom, 15),
      };
      programmaticPickerRecenter = target;
      destroyPopover();
      actions.setView(target);
      queueMicrotask(() => {
        if (programmaticPickerRecenter === target && cameraMatches(map, target)) {
          programmaticPickerRecenter = null;
        }
      });
      return;
    }

    destroyPopover();
    if (action === "openInMaps") {
      openHandoff(point);
      return;
    }

    const coordinateText = formatPickedCoordinates(point);
    void writeClipboard(coordinateText)
      .then(() => {
        actions.showToast("info", t("picker.copied", {}, locale()));
      })
      .catch(() => {
        actions.showToast("error", t("picker.copyFailed", {}, locale()));
      });
  }

  function openPopover(): void {
    destroyPopover();
    const nextPopover = el("aside", {
      class: "point-picker-popover",
      role: "menu",
      "aria-label": t("picker.travelHere", {}, locale()),
    });
    const buttons = new Map<PickerAction, HTMLButtonElement>();

    for (const action of ["travelHere", "openInMaps", "copyCoords"] as const) {
      const button = el("button", {
        type: "button",
        role: "menuitem",
        class: "point-picker-popover__item",
        "data-picker-action": action,
      });
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleAction(action);
      });
      buttons.set(action, button);
      nextPopover.append(button);
    }

    popover = nextPopover;
    parent.append(nextPopover);
    renderPopoverLabels(buttons);
    renderPopoverPosition();
    unsubscribePopoverLanguage = onLangChange(store, () => {
      renderPopoverLabels(buttons);
      nextPopover.setAttribute("aria-label", t("picker.travelHere", {}, locale()));
      renderPopoverPosition();
    });
    buttons.get("travelHere")?.focus({ preventScroll: true });
  }

  function handleLongPress(lngLat: MapLngLat): void {
    const coordinates = latLng(lngLat.lat, lngLat.lng);
    if (coordinates === null) return;

    suppressMapClickUntil = Date.now() + MAP_CLICK_SUPPRESSION_MS;
    programmaticPickerRecenter = null;
    destroyPopover();
    pickedPoint = coordinates;
    renderPickedPoint();
    openPopover();
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    if (pickedPoint === null) return;
    const target = event.target;
    if (target instanceof Node && popover?.contains(target)) return;
    dismissPickedPoint();
  }

  function handleDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || pickedPoint === null) return;
    event.preventDefault();
    dismissPickedPoint();
  }

  function handleMapClick(): void {
    if (Date.now() <= suppressMapClickUntil) return;
    dismissPickedPoint();
  }

  function handleMapMove(event: unknown): void {
    if (programmaticPickerRecenter !== null) {
      if (eventHasOriginalEvent(event)) {
        dismissPickedPoint();
      }
      return;
    }
    if (eventHasOriginalEvent(event)) dismissPickedPoint();
  }

  function handleUserGestureStart(event: unknown): void {
    // MapLibre emits zoomstart/dragstart for some programmatic camera changes too. The
    // picker recenter guard is only released by a matching moveend or an event with a real
    // originating pointer/wheel event.
    if (programmaticPickerRecenter !== null && !eventHasOriginalEvent(event)) return;
    dismissPickedPoint();
  }

  function handleMapMoveEnd(): void {
    if (programmaticPickerRecenter !== null && cameraMatches(map, programmaticPickerRecenter)) {
      programmaticPickerRecenter = null;
    }
  }

  const unsubscribeLongPress = controllerShape.onLongPress(handleLongPress);
  const handleStyleReady = (): void => renderPickedPoint();
  map.on("styledata", handleStyleReady);
  map.on("load", handleStyleReady);
  map.on("click", handleMapClick);
  map.on("move", handleMapMove);
  map.on("moveend", handleMapMoveEnd);
  map.on("dragstart", handleUserGestureStart);
  map.on("zoomstart", handleUserGestureStart);
  map.on("rotatestart", handleUserGestureStart);
  map.on("pitchstart", handleUserGestureStart);
  map.on("rollstart", handleUserGestureStart);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeyDown);
  window.addEventListener("resize", renderPopoverPosition);

  return {
    getPickedPoint: () => pickedPoint,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeLongPress();
      map.off("styledata", handleStyleReady);
      map.off("load", handleStyleReady);
      map.off("click", handleMapClick);
      map.off("move", handleMapMove);
      map.off("moveend", handleMapMoveEnd);
      map.off("dragstart", handleUserGestureStart);
      map.off("zoomstart", handleUserGestureStart);
      map.off("rotatestart", handleUserGestureStart);
      map.off("pitchstart", handleUserGestureStart);
      map.off("rollstart", handleUserGestureStart);
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      window.removeEventListener("resize", renderPopoverPosition);
      destroyPopover();
      handoffMenu?.destroy();
      handoffMenu = undefined;
      pickedPoint = null;
      programmaticPickerRecenter = null;
      removePickedPointLayers();
    },
  };
}

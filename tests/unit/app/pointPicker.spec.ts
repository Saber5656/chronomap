import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculatePopoverPlacement,
  formatPickedCoordinates,
  mountPointPicker,
  PICKED_POINT_LAYER_ID,
  PICKED_POINT_SOURCE_ID,
} from "../../../src/app/pointPicker";
import type { MapController, MapLngLat } from "../../../src/map/mapController";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

type Listener = (event?: unknown) => void;

function createFakeMap() {
  const listeners = new Map<string, Set<Listener>>();
  const sources = new Map<
    string,
    { type: "geojson"; data: unknown; setData(data: unknown): void }
  >();
  const layers = new Map<string, Record<string, unknown>>();
  const container = document.createElement("div");
  const containerRect = { left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844 };
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(containerRect as unknown as DOMRect);

  const map = {
    isStyleLoaded: vi.fn(() => true),
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string, source: { type: "geojson"; data: unknown }) => {
      sources.set(id, {
        ...source,
        setData(data: unknown) {
          this.data = data;
        },
      });
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    getLayer: (id: string) => layers.get(id),
    addLayer: vi.fn((layer: Record<string, unknown>) => {
      layers.set(String(layer.id), layer);
    }),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    project: vi.fn(() => ({ x: 195, y: 422 })),
    getContainer: () => container,
    getCenter: vi.fn(() => ({ lat: 36.5, lng: 138.5 })),
    getZoom: vi.fn(() => 5),
    on: vi.fn((type: string, listener: Listener) => {
      const typeListeners = listeners.get(type) ?? new Set<Listener>();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
      return map;
    }),
    off: vi.fn((type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
      return map;
    }),
    emit(type: string, event?: unknown) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    sources,
    layers,
  };

  return map;
}

function createHarness(options: Parameters<typeof mountPointPicker>[3] = {}) {
  const parent = document.createElement("div");
  Object.defineProperty(parent, "clientWidth", { configurable: true, value: 390 });
  Object.defineProperty(parent, "clientHeight", { configurable: true, value: 844 });
  vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 390,
    height: 844,
    right: 390,
    bottom: 844,
  } as unknown as DOMRect);
  document.body.append(parent);

  const map = createFakeMap();
  let longPressListener: ((point: MapLngLat) => void) | undefined;
  const mapController = {
    getMap: () => map,
    onLongPress: (listener: (point: MapLngLat) => void) => {
      longPressListener = listener;
      return () => {
        longPressListener = undefined;
      };
    },
  } as unknown as MapController;
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const picker = mountPointPicker(parent, store, mapController, options);

  return {
    map,
    mapController,
    picker,
    parent,
    store,
    emitLongPress(point: MapLngLat) {
      longPressListener?.(point);
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("calculatePopoverPlacement", () => {
  const viewport = { width: 390, height: 844 };
  const popover = { width: 220, height: 150 };
  const safeArea = { top: 12, right: 12, bottom: 108, left: 12 };

  it("keeps a centered popover below the anchor", () => {
    expect(calculatePopoverPlacement({ x: 195, y: 200 }, popover, viewport, safeArea)).toEqual({
      left: 85,
      top: 212,
      side: "below",
    });
  });

  it("flips above a low anchor and clamps to the horizontal safe area", () => {
    expect(calculatePopoverPlacement({ x: 8, y: 780 }, popover, viewport, safeArea)).toEqual({
      left: 12,
      top: 586,
      side: "above",
    });
  });
});

describe("point picker", () => {
  it("formats validated coordinates with six decimal places", () => {
    expect(formatPickedCoordinates({ lat: 35.681236, lng: 139.767125 })).toBe(
      "35.681236,139.767125",
    );
  });

  it("does not mutate the map style before a point is picked", () => {
    const harness = createHarness();

    expect(harness.map.sources.has(PICKED_POINT_SOURCE_ID)).toBe(false);
    expect(harness.map.layers.has(PICKED_POINT_LAYER_ID)).toBe(false);
    harness.picker.destroy();
  });

  it("renders one ephemeral marker and replaces it on the next long press", () => {
    const harness = createHarness();
    harness.emitLongPress({ lat: 35.681236, lng: 139.767125 });

    expect(harness.picker.getPickedPoint()).toEqual({ lat: 35.681236, lng: 139.767125 });
    expect(harness.map.sources.get(PICKED_POINT_SOURCE_ID)?.data).toMatchObject({
      features: [
        {
          geometry: { coordinates: [139.767125, 35.681236] },
          properties: { kind: "picked" },
        },
      ],
    });
    expect(harness.map.layers.has(PICKED_POINT_LAYER_ID)).toBe(true);
    expect(harness.parent.querySelectorAll("[data-picker-action]")).toHaveLength(3);

    harness.emitLongPress({ lat: 34.6937, lng: 135.5023 });
    expect(harness.picker.getPickedPoint()).toEqual({ lat: 34.6937, lng: 135.5023 });
    expect(harness.map.sources.get(PICKED_POINT_SOURCE_ID)?.data).toMatchObject({
      features: [{ geometry: { coordinates: [135.5023, 34.6937] } }],
    });

    harness.picker.destroy();
    expect(harness.picker.getPickedPoint()).toBeNull();
    expect(harness.map.sources.has(PICKED_POINT_SOURCE_ID)).toBe(false);
    expect(harness.map.layers.has(PICKED_POINT_LAYER_ID)).toBe(false);
  });

  it("renders an imported marker with a sanitized text-only label callout", () => {
    const harness = createHarness();
    harness.picker.setPickedPoint({ lat: 35.681236, lng: 139.767125 }, "<Tokyo>");

    expect(harness.picker.getPickedPoint()).toEqual({ lat: 35.681236, lng: 139.767125 });
    expect(harness.map.sources.get(PICKED_POINT_SOURCE_ID)?.data).toMatchObject({
      features: [
        {
          properties: { kind: "picked", label: "<Tokyo>" },
        },
      ],
    });
    expect(harness.parent.querySelector(".point-picker-label-callout")?.textContent).toBe(
      "<Tokyo>",
    );
    expect(harness.parent.querySelector(".point-picker-label-callout script")).toBeNull();

    harness.picker.destroy();
  });

  it("recenters through actions while keeping the marker after programmatic movement", () => {
    const harness = createHarness();
    harness.emitLongPress({ lat: 35.681236, lng: 139.767125 });
    harness.parent.querySelector<HTMLButtonElement>('[data-picker-action="travelHere"]')?.click();

    expect(harness.store.get().view).toEqual({ lat: 35.681236, lng: 139.767125, zoom: 15 });
    expect(harness.picker.getPickedPoint()).toEqual({ lat: 35.681236, lng: 139.767125 });
    expect(harness.parent.querySelector(".point-picker-popover")).toBeNull();
  });

  it("copies coordinates, opens handoff, and dismisses on an outside pointer", async () => {
    const clipboardWrite = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const showHandoffMenu = vi.fn(() => ({ destroy: vi.fn() }));
    const harness = createHarness({ showHandoffMenu });

    harness.emitLongPress({ lat: 35.681236, lng: 139.767125 });
    harness.parent.querySelector<HTMLButtonElement>('[data-picker-action="copyCoords"]')?.click();
    await Promise.resolve();
    expect(clipboardWrite).toHaveBeenCalledWith("35.681236,139.767125");
    expect(harness.store.get().ui.toast?.text).toBe("座標をコピーしました");

    harness.emitLongPress({ lat: 35.681236, lng: 139.767125 });
    harness.parent.querySelector<HTMLButtonElement>('[data-picker-action="openInMaps"]')?.click();
    expect(showHandoffMenu).toHaveBeenCalledWith(
      35.681236,
      139.767125,
      expect.objectContaining({ parent: harness.parent, store: harness.store }),
    );

    harness.emitLongPress({ lat: 35.681236, lng: 139.767125 });
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(harness.picker.getPickedPoint()).toBeNull();
  });

  it("dismisses the marker on a user gesture but not on a programmatic move", () => {
    const harness = createHarness();
    harness.emitLongPress({ lat: 35.681236, lng: 139.767125 });
    harness.map.emit("move", { originalEvent: undefined });
    expect(harness.picker.getPickedPoint()).not.toBeNull();
    harness.map.emit("dragstart");
    expect(harness.picker.getPickedPoint()).toBeNull();
  });
});

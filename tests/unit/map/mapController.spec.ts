import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Listener = (event?: unknown) => void;
  type FakeFlyTo = {
    id: number;
    options: { center: [number, number]; zoom: number };
    cancelled: boolean;
    completed: boolean;
  };

  class FakeMap {
    static instances: FakeMap[] = [];
    readonly options: Record<string, unknown>;
    readonly controls: unknown[] = [];
    readonly listeners = new globalThis.Map<string, Set<Listener>>();
    readonly sources = new globalThis.Map<string, Record<string, unknown>>();
    readonly layers = new globalThis.Map<string, Record<string, unknown>>();
    styleLoaded = true;
    readonly state = {
      center: { lat: 36.5, lng: 138.5 },
      zoom: 5,
      bounds: { west: 130, south: 30, east: 145, north: 46 },
    };
    readonly flyTos: FakeFlyTo[] = [];
    readonly dragRotate = { disable: vi.fn() };
    readonly touchZoomRotate = { disableRotation: vi.fn() };
    readonly keyboard = { disableRotation: vi.fn() };
    readonly stop = vi.fn(() => {
      for (const operation of this.flyTos) {
        if (operation.cancelled || operation.completed) continue;
        operation.cancelled = true;
        this.emit("moveend", { originalEvent: undefined });
      }
      return this;
    });
    readonly remove = vi.fn();
    readonly removeControl = vi.fn((control: unknown) => {
      const index = this.controls.indexOf(control);
      if (index >= 0) this.controls.splice(index, 1);
    });
    readonly setMinPitch = vi.fn();
    readonly setMaxPitch = vi.fn();
    readonly setPaintProperty = vi.fn((layerId: string, property: string, value: unknown) => {
      const layer = this.layers.get(layerId);
      if (layer !== undefined) {
        const paint = layer.paint as Record<string, unknown>;
        paint[property] = value;
      }
      return this;
    });
    readonly flyTo = vi.fn((options: { center: [number, number]; zoom: number }) => {
      this.flyTos.push({
        id: this.flyTos.length + 1,
        options,
        cancelled: false,
        completed: false,
      });
      return this;
    });
    readonly unproject = vi.fn((point: [number, number]) => ({
      lng: point[0] / 10,
      lat: point[1] / 10,
    }));

    constructor(options: Record<string, unknown>) {
      this.options = options;
      const center = options.center as [number, number];
      this.state.center = { lng: center[0], lat: center[1] };
      this.state.zoom = options.zoom as number;
      FakeMap.instances.push(this);
    }

    addControl(control: unknown): this {
      this.controls.push(control);
      return this;
    }

    isStyleLoaded(): boolean {
      return this.styleLoaded;
    }

    addSource(id: string, source: Record<string, unknown>): this {
      const entry: Record<string, unknown> = { ...source };
      entry.setData = vi.fn((data: unknown) => {
        entry.data = data;
        return Promise.resolve();
      });
      this.sources.set(id, entry);
      return this;
    }

    getSource(id: string): Record<string, unknown> | undefined {
      return this.sources.get(id);
    }

    addLayer(layer: Record<string, unknown>): this {
      this.layers.set(layer.id as string, layer);
      return this;
    }

    getLayer(id: string): Record<string, unknown> | undefined {
      return this.layers.get(id);
    }

    on(type: string, listener: Listener): this {
      const listeners = this.listeners.get(type) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(type, listeners);
      return this;
    }

    off(type: string, listener: Listener): this {
      this.listeners.get(type)?.delete(listener);
      return this;
    }

    emit(type: string, event: unknown = {}): void {
      for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    }

    getCenter(): { lat: number; lng: number } {
      return this.state.center;
    }

    getZoom(): number {
      return this.state.zoom;
    }

    getBounds(): {
      getWest(): number;
      getSouth(): number;
      getEast(): number;
      getNorth(): number;
    } {
      return {
        getWest: () => this.state.bounds.west,
        getSouth: () => this.state.bounds.south,
        getEast: () => this.state.bounds.east,
        getNorth: () => this.state.bounds.north,
      };
    }

    jumpTo(options: { center: [number, number]; zoom: number }): this {
      this.state.center = { lng: options.center[0], lat: options.center[1] };
      this.state.zoom = options.zoom;
      this.emit("moveend", { originalEvent: undefined });
      return this;
    }

    async resolveFlyTo(id: number): Promise<void> {
      const operation = this.flyTos.find((candidate) => candidate.id === id);
      if (operation === undefined || operation.completed) return;

      await Promise.resolve();
      operation.completed = true;
      if (!operation.cancelled) {
        this.state.center = { lng: operation.options.center[0], lat: operation.options.center[1] };
        this.state.zoom = operation.options.zoom;
      }
      this.emit("moveend", { originalEvent: undefined });
    }

    emitStaleMoveEnd(): void {
      this.emit("moveend", { originalEvent: undefined });
    }

    userMove(center: { lat: number; lng: number }, zoom: number): void {
      this.state.center = center;
      this.state.zoom = zoom;
      this.emit("moveend", { originalEvent: new Event("pointerup") });
    }

    loaded(): boolean {
      return true;
    }
  }

  class FakeAttributionControl {
    constructor(readonly options: unknown) {}
  }

  return { FakeAttributionControl, FakeMap };
});

vi.mock("maplibre-gl", () => ({
  AttributionControl: mocks.FakeAttributionControl,
  Map: mocks.FakeMap,
}));

import {
  GSI_ATTRIBUTION,
  GSI_BASEMAP_SOURCE_ID,
  GSI_PALE_TILE_URL,
  createMap,
} from "../../../src/map/mapController";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

function setup() {
  mocks.FakeMap.instances.length = 0;
  const container = document.createElement("div");
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const controller = createMap(container, store);
  const map = mocks.FakeMap.instances[0]!;
  return { container, controller, map, store };
}

function emitPointer(
  container: HTMLElement,
  type: string,
  init: {
    clientX: number;
    clientY: number;
    pointerId: number;
    isPrimary?: boolean;
    button?: number;
    pointerType?: string;
  },
): void {
  const event = Object.assign(new Event(type, { bubbles: true }), {
    clientX: init.clientX,
    clientY: init.clientY,
    pointerId: init.pointerId,
    isPrimary: init.isPrimary ?? true,
    button: init.button ?? 0,
    pointerType: init.pointerType ?? "touch",
  }) as PointerEvent;
  container.dispatchEvent(event);
}

describe("createMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("creates a pale GSI raster map with compact attribution and north-up options", () => {
    const { controller, map } = setup();
    const style = map.options.style as {
      sources: Record<
        string,
        { tiles: string[]; tileSize: number; minzoom: number; maxzoom: number; attribution: string }
      >;
    };

    expect(style.sources[GSI_BASEMAP_SOURCE_ID]).toMatchObject({
      tiles: [GSI_PALE_TILE_URL],
      tileSize: 256,
      minzoom: 2,
      maxzoom: 18,
      attribution: GSI_ATTRIBUTION,
    });
    expect(map.options).toMatchObject({
      minZoom: 2,
      maxZoom: 18,
      minPitch: 0,
      maxPitch: 0,
      dragRotate: false,
      touchZoomRotate: true,
      touchPitch: false,
      pitchWithRotate: false,
      rollEnabled: false,
      attributionControl: false,
    });
    expect(map.touchZoomRotate.disableRotation).toHaveBeenCalledOnce();
    expect(map.keyboard.disableRotation).toHaveBeenCalledOnce();
    expect(map.controls).toHaveLength(1);
    expect(map.controls[0]).toMatchObject({ options: { compact: true } });
    expect((map.controls[0] as { options: Record<string, unknown> }).options).not.toHaveProperty(
      "customAttribution",
    );

    controller.destroy();
  });

  it("normalizes camera coordinates before store comparison and synchronization", async () => {
    const { controller, map, store } = setup();

    map.state.center = { lat: 35.123456789, lng: 139.987654321 };
    map.state.zoom = 12.34567;
    map.emit("moveend", { originalEvent: new Event("pointerup") });

    expect(store.get().view).toEqual({ lat: 35.123457, lng: 139.987654, zoom: 12.35 });

    store.set({ view: { lat: 40.123456789, lng: 140.654321987, zoom: 8.7654 } });
    expect(map.state.center).toEqual({ lat: 40.123457, lng: 140.654322 });
    expect(map.state.zoom).toBe(8.77);
    expect(map.stop).toHaveBeenCalled();

    await Promise.resolve();
    expect(store.get().view).toEqual({ lat: 40.123457, lng: 140.654322, zoom: 8.77 });

    controller.destroy();
  });

  it("ignores stale programmatic moveend events after rapid store updates", () => {
    const { controller, map, store } = setup();
    const views = [
      { lat: 34.1, lng: 135.1, zoom: 6.1 },
      { lat: 35.2, lng: 136.2, zoom: 7.2 },
      { lat: 36.3, lng: 137.3, zoom: 8.3 },
    ];

    for (const view of views) store.set({ view });
    expect(store.get().view).toEqual(views[2]);
    expect(map.state.center).toEqual({ lat: views[2]!.lat, lng: views[2]!.lng });

    map.state.center = { lat: views[0]!.lat, lng: views[0]!.lng };
    map.state.zoom = views[0]!.zoom;
    map.emit("moveend", { originalEvent: undefined });

    expect(store.get().view).toEqual(views[2]);
    controller.destroy();
  });

  it("keeps overlapping and cancelled flyTo operations generation-safe", async () => {
    const { controller, map, store } = setup();

    const firstTarget = { lat: 35.123456789, lng: 139.987654321 };
    const secondTarget = { lat: 34.567890123, lng: 135.456789987 };

    controller.flyToUser(firstTarget);
    controller.flyToUser(secondTarget);

    expect(map.flyTos).toHaveLength(2);
    expect(map.flyTos[0]?.cancelled).toBe(true);

    await map.resolveFlyTo(map.flyTos[0]!.id);
    expect(store.get().view).toEqual({ lat: 36.5, lng: 138.5, zoom: 5 });

    await map.resolveFlyTo(map.flyTos[1]!.id);
    expect(store.get().view).toEqual({ lat: 36.5, lng: 138.5, zoom: 5 });

    const convergedView = store.get().view;
    map.emitStaleMoveEnd();
    expect(store.get().view).toBe(convergedView);

    controller.destroy();
  });

  it("lets a user move cancel flyTo and converge after a stale moveend", async () => {
    const { controller, map, store } = setup();

    controller.flyToUser({ lat: 35.123456789, lng: 139.987654321 });
    map.userMove({ lat: 43.123456789, lng: 141.987654321 }, 9.876);

    expect(store.get().view).toEqual({ lat: 43.123457, lng: 141.987654, zoom: 9.88 });

    await map.resolveFlyTo(map.flyTos[0]!.id);
    expect(store.get().view).toEqual({ lat: 43.123457, lng: 141.987654, zoom: 9.88 });

    controller.destroy();
  });

  it("exposes bbox and idle subscription teardown", () => {
    const { controller, map } = setup();
    const callback = vi.fn();
    const unsubscribe = controller.onIdle(callback);

    map.emit("idle");
    expect(callback).toHaveBeenCalledOnce();
    expect(controller.getViewportBbox()).toEqual([130, 30, 145, 46]);

    unsubscribe();
    map.emit("idle");
    expect(callback).toHaveBeenCalledOnce();
    controller.destroy();
    map.emit("idle");
    expect(callback).toHaveBeenCalledOnce();
  });

  it("fires one touch long press and cancels on movement, extra pointers, and map movement", () => {
    vi.useFakeTimers();
    const { container, controller, map } = setup();
    const callback = vi.fn();
    controller.onLongPress(callback);

    emitPointer(container, "pointerdown", { pointerId: 1, clientX: 20, clientY: 30 });
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalledWith({ lng: 2, lat: 3 });
    emitPointer(container, "pointerup", { pointerId: 1, clientX: 20, clientY: 30 });
    expect(callback).toHaveBeenCalledOnce();

    emitPointer(container, "pointerdown", { pointerId: 2, clientX: 10, clientY: 10 });
    emitPointer(container, "pointermove", { pointerId: 2, clientX: 18, clientY: 10 });
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalledOnce();

    emitPointer(container, "pointerdown", { pointerId: 3, clientX: 10, clientY: 10 });
    emitPointer(container, "pointerdown", { pointerId: 4, clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalledOnce();

    emitPointer(container, "pointerdown", { pointerId: 5, clientX: 10, clientY: 10 });
    map.emit("move");
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalledOnce();

    emitPointer(container, "pointerdown", {
      pointerId: 6,
      clientX: 10,
      clientY: 10,
      pointerType: "mouse",
    });
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalledOnce();

    emitPointer(container, "pointerdown", { pointerId: 7, clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(100);
    emitPointer(container, "pointerup", { pointerId: 7, clientX: 10, clientY: 10 });
    map.emit("contextmenu", { lngLat: { lng: 139.7, lat: 35.6 }, preventDefault: vi.fn() });
    expect(callback).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it("handles desktop contextmenu once and suppresses the synthetic touch menu", () => {
    const { controller, map } = setup();
    const callback = vi.fn();
    controller.onLongPress(callback);
    const preventDefault = vi.fn();

    map.emit("contextmenu", { lngLat: { lng: 139.7, lat: 35.6 }, preventDefault });
    map.emit("contextmenu", { lngLat: { lng: 139.7, lat: 35.6 }, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it("uses jumpTo for reduced motion and keeps geolocation camera state transient", () => {
    const { controller, map, store } = setup();
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);

    controller.flyToUser({ lat: 35.681236, lng: 139.767125 });
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.state.center).toEqual({ lat: 35.681236, lng: 139.767125 });
    expect(map.state.zoom).toBe(15);
    expect(store.get().view).toEqual({ lat: 36.5, lng: 138.5, zoom: 5 });

    matchMedia.mockReturnValue({ matches: false });
    map.flyTo.mockImplementation((options: { center: [number, number]; zoom: number }) => {
      map.state.center = { lng: options.center[0], lat: options.center[1] };
      map.state.zoom = options.zoom;
      map.emit("moveend", { originalEvent: undefined });
      return map;
    });
    controller.flyToUser({ lat: 34.6937, lng: 135.5023 });
    expect(map.flyTo).toHaveBeenCalledWith({
      center: [135.5023, 34.6937],
      zoom: 15,
      bearing: 0,
      pitch: 0,
      roll: 0,
      duration: 1500,
    });
    expect(store.get().view).toEqual({ lat: 36.5, lng: 138.5, zoom: 5 });

    controller.destroy();
  });

  it("keeps a geolocation camera fix out of the persistent view state", () => {
    const { controller, map, store } = setup();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    controller.flyToUser({ lat: 35.681236, lng: 139.767125 });

    expect(map.state.center).toEqual({ lat: 35.681236, lng: 139.767125 });
    expect(map.state.zoom).toBe(15);
    expect(store.get().view).toEqual({ lat: 36.5, lng: 138.5, zoom: 5 });

    map.userMove({ lat: 35, lng: 139 }, 12);
    expect(store.get().view).toEqual({ lat: 35, lng: 139, zoom: 12 });
    controller.destroy();
  });

  it("renders a persistent GeoJSON user fix with accuracy and dot layers", () => {
    const { controller, map } = setup();
    const fix = { lat: 35.681236, lng: 139.767125, accuracyM: 100, at: 123 };

    controller.setUserFix(fix);

    const source = map.sources.get("chronomap-user");
    expect(source?.type).toBe("geojson");
    expect(source?.data).toMatchObject({
      type: "FeatureCollection",
      features: [
        expect.objectContaining({
          properties: { kind: "accuracy" },
          geometry: { type: "Point", coordinates: [fix.lng, fix.lat] },
        }),
        expect.objectContaining({
          properties: { kind: "dot" },
          geometry: { type: "Point", coordinates: [fix.lng, fix.lat] },
        }),
      ],
    });
    expect(map.layers.has("chronomap-user-accuracy")).toBe(true);
    expect(map.layers.has("chronomap-user-dot")).toBe(true);

    const sourceEntry = source;
    const accuracyLayer = map.layers.get("chronomap-user-accuracy");
    const accuracyPaint = accuracyLayer?.paint;
    if (typeof accuracyPaint !== "object" || accuracyPaint === null) {
      throw new Error("Expected an accuracy layer paint object.");
    }
    expect(typeof (accuracyPaint as Record<string, unknown>)["circle-radius"]).toBe("number");

    map.state.zoom = 15;
    map.emit("zoom");
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      "chronomap-user-accuracy",
      "circle-radius",
      expect.any(Number),
    );

    controller.setUserFix({ ...fix, lat: 34.6937, lng: 135.5023 });
    expect(sourceEntry?.data).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "accuracy" },
          geometry: { type: "Point", coordinates: [135.5023, 34.6937] },
        },
        {
          type: "Feature",
          properties: { kind: "dot" },
          geometry: { type: "Point", coordinates: [135.5023, 34.6937] },
        },
      ],
    });
    expect(map.layers.size).toBe(2);

    controller.destroy();
  });

  it("retries the latest user fix after a source update finishes", () => {
    const { controller, map } = setup();
    const firstFix = { lat: 35.681236, lng: 139.767125, accuracyM: 100, at: 123 };
    const latestFix = { lat: 34.6937, lng: 135.5023, accuracyM: 80, at: 456 };

    controller.setUserFix(firstFix);
    const source = map.sources.get("chronomap-user");
    if (source === undefined) throw new Error("Expected the user location source.");

    map.styleLoaded = false;
    controller.setUserFix(latestFix);
    const firstSourceData = source.data as {
      features: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    expect(firstSourceData.features.map((feature) => feature.geometry.coordinates)).toContainEqual([
      firstFix.lng,
      firstFix.lat,
    ]);

    map.styleLoaded = true;
    map.emit("sourcedata", { sourceId: "chronomap-user" });
    const latestSourceData = source.data as {
      features: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    expect(latestSourceData.features.map((feature) => feature.geometry.coordinates)).toContainEqual(
      [latestFix.lng, latestFix.lat],
    );

    controller.destroy();
  });

  it("retries a pending user fix when an unrelated source finishes", () => {
    const { controller, map } = setup();
    const firstFix = { lat: 35.681236, lng: 139.767125, accuracyM: 100, at: 123 };
    const latestFix = { lat: 34.6937, lng: 135.5023, accuracyM: 80, at: 456 };

    controller.setUserFix(firstFix);
    const source = map.sources.get("chronomap-user");
    if (source === undefined) throw new Error("Expected the user location source.");

    map.styleLoaded = false;
    controller.setUserFix(latestFix);
    map.styleLoaded = true;
    map.emit("sourcedata", { sourceId: "gsi-pale" });

    const beforeIdle = source.data as {
      features: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    expect(beforeIdle.features.map((feature) => feature.geometry.coordinates)).not.toContainEqual([
      latestFix.lng,
      latestFix.lat,
    ]);

    map.emit("idle");
    const afterIdle = source.data as {
      features: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    expect(afterIdle.features.map((feature) => feature.geometry.coordinates)).toContainEqual([
      latestFix.lng,
      latestFix.lat,
    ]);

    controller.destroy();
  });

  it("tears down map listeners and is idempotent", () => {
    const { controller, map, store } = setup();
    controller.destroy();
    controller.destroy();

    expect(map.remove).toHaveBeenCalledOnce();
    expect(map.listeners.get("moveend")?.size).toBe(0);
    store.set({ view: { lat: 30, lng: 130, zoom: 6 } });
    expect(map.stop).not.toHaveBeenCalled();
  });
});

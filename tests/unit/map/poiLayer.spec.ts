import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initPoiController,
  POI_CIRCLE_LAYER_ID,
  POI_FETCH_DEBOUNCE_MS,
  POI_SOURCE_ID,
  POI_SYMBOL_LAYER_ID,
  shouldFetchPoi,
  stablePoiItems,
} from "../../../src/map/poiLayer";
import type { MapController } from "../../../src/map/mapController";
import type { Poi, PoiProvider } from "../../../src/providers/poi/types";
import { createActions } from "../../../src/state/actions";
import { createInitialState, type AppState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { poiFeatureId } from "../../../src/util/poi";

type Listener = (event?: unknown) => void;
type FakeSource = {
  type: "geojson";
  data: unknown;
  setData: (data: unknown) => Promise<void>;
};

class FakeMap {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly sources = new Map<string, FakeSource>();
  readonly layers = new Map<string, Record<string, unknown>>();
  readonly featureStates = new Map<number | string, Record<string, unknown>>();
  readonly images = new Set<string>();
  readonly layerOrder = [
    "background",
    "chronomap-past-gsi-ort-old10",
    "chronomap-user-accuracy",
    "chronomap-user-dot",
  ];
  queryFeatures: Array<{ properties?: Record<string, unknown> | null }> = [];
  styleLoaded = true;
  center = { lat: 35.681236, lng: 139.767125 };
  zoom = 15;
  bbox: [number, number, number, number] = [139.74, 35.64, 139.8, 35.72];

  on(type: string, listenerOrLayer: Listener | string, maybeListener?: Listener): this {
    const listener = typeof listenerOrLayer === "function" ? listenerOrLayer : maybeListener;
    if (listener === undefined) return this;
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
    return this;
  }

  off(type: string, listenerOrLayer: Listener | string, maybeListener?: Listener): this {
    const listener = typeof listenerOrLayer === "function" ? listenerOrLayer : maybeListener;
    if (listener !== undefined) this.listeners.get(type)?.delete(listener);
    return this;
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  isStyleLoaded(): boolean {
    return this.styleLoaded;
  }

  getCenter(): { lat: number; lng: number } {
    return this.center;
  }

  getZoom(): number {
    return this.zoom;
  }

  project(): { x: number; y: number } {
    return { x: 100, y: 100 };
  }

  getSource(id: string): FakeSource | undefined {
    return this.sources.get(id);
  }

  addSource(id: string, source: { data: unknown }): this {
    const entry: FakeSource = {
      type: "geojson",
      data: source.data,
      setData: (data) => {
        entry.data = data;
        return Promise.resolve();
      },
    };
    this.sources.set(id, entry);
    return this;
  }

  removeSource(id: string): this {
    this.sources.delete(id);
    return this;
  }

  getLayer(id: string): Record<string, unknown> | undefined {
    return this.layers.get(id);
  }

  addLayer(layer: Record<string, unknown>, beforeId?: string): this {
    const id = String(layer.id);
    this.layers.set(id, layer);
    const existingIndex = this.layerOrder.indexOf(id);
    if (existingIndex >= 0) this.layerOrder.splice(existingIndex, 1);
    const beforeIndex = beforeId === undefined ? -1 : this.layerOrder.indexOf(beforeId);
    if (beforeIndex < 0) this.layerOrder.push(id);
    else this.layerOrder.splice(beforeIndex, 0, id);
    return this;
  }

  removeLayer(id: string): this {
    this.layers.delete(id);
    const index = this.layerOrder.indexOf(id);
    if (index >= 0) this.layerOrder.splice(index, 1);
    return this;
  }

  getLayersOrder(): string[] {
    return [...this.layerOrder];
  }

  getStyle(): { layers: Array<{ id: string }> } {
    return { layers: this.layerOrder.map((id) => ({ id })) };
  }

  queryRenderedFeatures(): Array<{ properties?: Record<string, unknown> | null }> {
    return this.queryFeatures;
  }

  removeFeatureState(): this {
    this.featureStates.clear();
    return this;
  }

  setFeatureState(target: { id?: number | string }, state: Record<string, unknown>): this {
    if (target.id !== undefined) this.featureStates.set(target.id, state);
    return this;
  }

  hasImage(id: string): boolean {
    return this.images.has(id) || id === "chronomap-poi-icon";
  }

  addImage(id: string): this {
    this.images.add(id);
    return this;
  }

  removeImage(id: string): void {
    this.images.delete(id);
  }

  triggerRepaint(): this {
    return this;
  }

  getBounds(): {
    getWest(): number;
    getSouth(): number;
    getEast(): number;
    getNorth(): number;
  } {
    return {
      getWest: () => this.bbox[0],
      getSouth: () => this.bbox[1],
      getEast: () => this.bbox[2],
      getNorth: () => this.bbox[3],
    };
  }
}

type TestMapController = MapController & { emitIdle(): void };

function mapControllerFor(map: FakeMap): TestMapController {
  const idleListeners = new Set<() => void>();
  const controller = {
    getMap: () => map,
    getViewportBbox: () => map.bbox,
    onIdle: (callback: () => void): (() => boolean) => {
      idleListeners.add(callback);
      return () => idleListeners.delete(callback);
    },
    emitIdle: () => {
      for (const callback of [...idleListeners]) callback();
    },
  };
  return controller as unknown as TestMapController;
}

function poi(id: string, title = id): Poi {
  return {
    id,
    title,
    lat: 35.681236,
    lng: 139.767125,
    source: { provider: "wikipedia", lang: "ja", url: `https://ja.wikipedia.org/?curid=${id}` },
  };
}

function setup() {
  const map = new FakeMap();
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const actions = createActions(store);
  actions.setView({ lat: map.center.lat, lng: map.center.lng, zoom: map.zoom });
  const mapController = mapControllerFor(map);
  const emitIdle = (): void => mapController.emitIdle();
  return { map, store, actions, mapController, emitIdle };
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("shouldFetchPoi", () => {
  const truthTable: Array<{
    name: string;
    input: Parameters<typeof shouldFetchPoi>[0];
    result: boolean;
  }> = [
    {
      name: "disabled",
      input: {
        enabled: false,
        zoom: 15,
        centerMovedM: 0,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: null,
      },
      result: false,
    },
    {
      name: "below minimum zoom",
      input: {
        enabled: true,
        zoom: 12.99,
        centerMovedM: 0,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: null,
      },
      result: false,
    },
    {
      name: "first eligible idle",
      input: {
        enabled: true,
        zoom: 13,
        centerMovedM: 0,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: null,
      },
      result: true,
    },
    {
      name: "same center and radius",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: 250,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: { radiusBucket: 500 },
      },
      result: false,
    },
    {
      name: "exactly one quarter diagonal",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: 250,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: { radiusBucket: 500 },
      },
      result: false,
    },
    {
      name: "more than one quarter diagonal",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: 250.01,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: { radiusBucket: 500 },
      },
      result: true,
    },
    {
      name: "radius bucket changed without pan",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: 0,
        viewportDiagonalM: 1000,
        radiusBucket: 1000,
        lastFetch: { radiusBucket: 500 },
      },
      result: true,
    },
    {
      name: "radius bucket changed after small pan",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: 1,
        viewportDiagonalM: 1000,
        radiusBucket: 1000,
        lastFetch: { radiusBucket: 500 },
      },
      result: true,
    },
    {
      name: "invalid diagonal",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: 1000,
        viewportDiagonalM: Number.NaN,
        radiusBucket: 500,
        lastFetch: { radiusBucket: 500 },
      },
      result: false,
    },
    {
      name: "invalid movement",
      input: {
        enabled: true,
        zoom: 15,
        centerMovedM: Number.NaN,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: { radiusBucket: 500 },
      },
      result: false,
    },
    {
      name: "custom minimum zoom accepts threshold",
      input: {
        enabled: true,
        zoom: 10,
        minZoom: 10,
        centerMovedM: 0,
        viewportDiagonalM: 1000,
        radiusBucket: 500,
        lastFetch: null,
      },
      result: true,
    },
  ];

  it("has a focused truth table with at least ten policy rows", () => {
    expect(truthTable.length).toBeGreaterThanOrEqual(10);
    for (const row of truthTable) expect(shouldFetchPoi(row.input), row.name).toBe(row.result);
  });
});

describe("stablePoiItems", () => {
  it("keeps the previous id order while applying the incoming payload", () => {
    const previous = [poi("a", "old A"), poi("b", "old B")];
    const incoming = [poi("b", "new B"), poi("c", "new C"), poi("a", "new A")];

    expect(stablePoiItems(previous, incoming)).toEqual([incoming[2], incoming[0], incoming[1]]);
  });
});

describe("initPoiController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces idle events, applies movement policy, and transitions to ready", async () => {
    const { map, store, mapController, emitIdle } = setup();
    const first = poi("a");
    const second = poi("b");
    const search = vi.fn(() => Promise.resolve([first, second]));
    const provider: PoiProvider = { id: "test", minZoom: 13, search };
    const controller = initPoiController(mapController, store, provider);

    emitIdle();
    emitIdle();
    vi.advanceTimersByTime(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledOnce();
    expect(store.get().poi.status).toBe("loading");
    await flushPromises();
    expect(store.get().poi).toMatchObject({ status: "ready", items: [first, second] });

    map.center = { ...map.center, lat: map.center.lat + 0.0001 };
    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledOnce();

    map.center = { ...map.center, lat: map.center.lat + 0.03 };
    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(2);
    controller.destroy();
  });

  it("uses the uncapped viewport diagonal for large-screen movement thresholds", async () => {
    const { map, store, mapController, emitIdle } = setup();
    map.bbox = [139, 35, 140, 36];
    const search = vi.fn(() => Promise.resolve([poi("wide")]));
    const provider: PoiProvider = { id: "test", minZoom: 13, search };
    const controller = initPoiController(mapController, store, provider);

    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    await flushPromises();
    expect(search).toHaveBeenCalledOnce();

    map.center = { ...map.center, lat: map.center.lat + 0.25 };
    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("aborts the latest-only request when superseded or disabled", async () => {
    const { map, store, actions, mapController, emitIdle } = setup();
    const signals: AbortSignal[] = [];
    const resolvers: Array<(items: Poi[]) => void> = [];
    const search = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<Poi[]>((resolve) => {
          signals.push(signal);
          resolvers.push(resolve);
        }),
    );
    const provider: PoiProvider = { id: "test", minZoom: 13, search };
    const controller = initPoiController(mapController, store, provider);

    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledOnce();
    map.center = { ...map.center, lat: map.center.lat + 0.03 };
    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);

    actions.setPoiEnabled(false);
    await flushPromises();
    expect(signals[1]?.aborted).toBe(true);
    expect(store.get().poi).toMatchObject({
      enabled: false,
      status: "idle",
      items: [],
      selectedId: null,
    });

    resolvers[0]?.([poi("stale")]);
    resolvers[1]?.([poi("also-stale")]);
    await flushPromises();
    expect(store.get().poi.items).toEqual([]);

    actions.setPoiEnabled(true);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(3);
    controller.destroy();
  });

  it("clears for a locale change and refetches only at the next idle", async () => {
    const { store, actions, mapController, emitIdle } = setup();
    const locales: AppState["ui"]["lang"][] = [];
    const provider: PoiProvider = {
      id: "test",
      minZoom: 13,
      search: vi.fn(({ locale }: { locale: AppState["ui"]["lang"] }) => {
        locales.push(locale);
        return Promise.resolve([poi(locale)]);
      }),
    };
    const controller = initPoiController(mapController, store, provider);

    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    await flushPromises();
    expect(store.get().poi.items[0]?.id).toBe("ja");

    actions.setLang("en");
    await flushPromises();
    expect(store.get().poi).toMatchObject({ status: "idle", items: [], selectedId: null });
    expect(locales).toEqual(["ja"]);
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    await flushPromises();
    expect(locales).toEqual(["ja", "en"]);
    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    expect(locales).toEqual(["ja", "en"]);
    controller.destroy();
  });

  it("renders a diffed GeoJSON source above past layers and below user layers", async () => {
    const { map, store, actions, mapController, emitIdle } = setup();
    const provider: PoiProvider = {
      id: "test",
      minZoom: 13,
      search: vi.fn(() => Promise.resolve([poi("a", "Alpha"), poi("b", "Beta")])),
    };
    const controller = initPoiController(mapController, store, provider);

    emitIdle();
    await vi.advanceTimersByTimeAsync(POI_FETCH_DEBOUNCE_MS);
    await flushPromises();
    expect(map.getSource(POI_SOURCE_ID)?.data).toMatchObject({
      type: "FeatureCollection",
      features: [
        { id: poiFeatureId("a"), properties: { id: "a", title: "Alpha" } },
        { id: poiFeatureId("b"), properties: { id: "b", title: "Beta" } },
      ],
    });
    expect(map.getLayer(POI_CIRCLE_LAYER_ID)).toBeDefined();
    expect(map.getLayer(POI_SYMBOL_LAYER_ID)).toBeDefined();
    expect(map.getLayersOrder().indexOf(POI_CIRCLE_LAYER_ID)).toBeGreaterThan(
      map.getLayersOrder().indexOf("chronomap-past-gsi-ort-old10"),
    );
    expect(map.getLayersOrder().indexOf(POI_SYMBOL_LAYER_ID)).toBeLessThan(
      map.getLayersOrder().indexOf("chronomap-user-accuracy"),
    );

    actions.selectPoi("b");
    expect(map.featureStates.get(poiFeatureId("b"))).toEqual({ selected: true });
    map.queryFeatures = [{ properties: { id: "b" } }];
    map.emit("click", { point: { x: 10, y: 10 } });
    expect(store.get().poi.selectedId).toBe("b");
    expect(store.get().ui.sheet).toBe("poi");
    map.queryFeatures = [];
    map.emit("click", { point: { x: 10, y: 10 } });
    expect(store.get().poi.selectedId).toBeNull();
    expect(store.get().ui.sheet).toBe("poi");
    controller.destroy();
  });
});

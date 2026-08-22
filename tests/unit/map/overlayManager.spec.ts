import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOverlayManager, pastLayerId, pastSourceId } from "../../../src/map/overlayManager";
import type { MapController } from "../../../src/map/mapController";
import type { LayerEntry } from "../../../src/providers/layers/types";
import { createInitialState, type AppState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import type { OverlayTransitionScheduler } from "../../../src/map/overlayTransition";

interface FakeStyleLayer {
  id: string;
  type: string;
  source?: string;
  paint?: Record<string, number>;
}

class FakeScheduler implements OverlayTransitionScheduler {
  private nextHandle = 1;
  private callbacks = new Map<number, (timestamp: number) => void>();
  private currentTime = 0;

  requestAnimationFrame(callback: (timestamp: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    this.callbacks.delete(handle);
  }

  now(): number {
    return this.currentTime;
  }

  flush(timestamp: number): void {
    this.currentTime = timestamp;
    const next = this.callbacks.entries().next();
    if (next.done) return;
    this.callbacks.delete(next.value[0]);
    next.value[1](timestamp);
  }

  pendingCount(): number {
    return this.callbacks.size;
  }
}

class FakeMap {
  readonly style = {
    version: 8,
    sources: {} as Record<string, Record<string, unknown>>,
    layers: [
      { id: "background", type: "background" },
      { id: "gsi-pale", type: "raster", source: "gsi-pale" },
      { id: "road-label", type: "symbol" },
      { id: "chronomap-poi-pins", type: "circle" },
      { id: "chronomap-user-accuracy", type: "circle" },
    ] as FakeStyleLayer[],
  };
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  _removed = false;

  isStyleLoaded(): boolean {
    return true;
  }

  getContainer(): HTMLElement {
    return document.createElement("div");
  }

  getStyle() {
    return this.style;
  }

  getLayersOrder(): string[] {
    return this.style.layers.map((layer) => layer.id);
  }

  getSource(id: string): Record<string, unknown> | undefined {
    return this.style.sources[id];
  }

  addSource(id: string, source: Record<string, unknown>): void {
    this.style.sources[id] = source;
  }

  removeSource(id: string): void {
    delete this.style.sources[id];
  }

  getLayer(id: string): FakeStyleLayer | undefined {
    return this.style.layers.find((layer) => layer.id === id);
  }

  addLayer(layer: FakeStyleLayer, beforeId?: string): void {
    const index =
      beforeId === undefined ? -1 : this.style.layers.findIndex(({ id }) => id === beforeId);
    if (index < 0) this.style.layers.push(layer);
    else this.style.layers.splice(index, 0, layer);
  }

  removeLayer(id: string): void {
    const index = this.style.layers.findIndex((layer) => layer.id === id);
    if (index >= 0) this.style.layers.splice(index, 1);
  }

  setPaintProperty(id: string, name: string, value: number): void {
    const layer = this.getLayer(id);
    if (layer === undefined) throw new Error(`missing layer: ${id}`);
    layer.paint ??= {};
    layer.paint[name] = value;
  }

  on(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  off(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  getZoom(): number {
    return 16;
  }
}

function entry(id: string, scheme: "xyz" | "tms" = "xyz"): LayerEntry {
  return {
    id,
    type: "raster-era",
    provider: scheme === "tms" ? "konjaku" : "gsi",
    title: { ja: id, en: id },
    era: { from: 1960, to: 1980 },
    region: "JP",
    coverage: [[128, 30, 146.5, 45.8]],
    tiles: {
      urlTemplate: `https://tiles.example/${id}/{z}/{x}/{y}.png`,
      scheme,
      minzoom: 8,
      maxzoom: 18,
      tileSize: 256,
    },
    attribution: {
      text: `${id} attribution`,
      license: { name: "Provider terms" },
    },
    flags: { experimental: scheme === "tms", requiresFeatureFlag: null },
    priority: 10,
  };
}

function setup(
  registry: readonly LayerEntry[] = [],
  state: AppState = createInitialState(new Date(2026, 0, 1)),
) {
  const map = new FakeMap();
  const store = createStore(state);
  const scheduler = new FakeScheduler();
  const mapController = {
    getMap: () => map,
    getViewportBbox: () => [128, 30, 146.5, 45.8] as const,
    onIdle: () => () => undefined,
  } as unknown as MapController;
  const manager = createOverlayManager(mapController, store, registry, {
    scheduler,
    prefersReducedMotion: () => false,
    debug: false,
  });
  return { manager, map, store, scheduler };
}

function pastSources(map: FakeMap): string[] {
  return Object.keys(map.style.sources).filter((id) => id.startsWith("chronomap-past-src-"));
}

function pastLayers(map: FakeMap): FakeStyleLayer[] {
  return map.style.layers.filter((layer) => layer.id.startsWith("chronomap-past-"));
}

describe("createOverlayManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the required raster source and puts the layer below symbols, POIs, and user layers", () => {
    const tms = entry("konjaku-test", "tms");
    const { manager, map, scheduler } = setup();

    manager.setLayer(tms, 0.6);
    const source = map.style.sources[pastSourceId(tms.id)];
    const layer = map.getLayer(pastLayerId(tms.id));

    expect(source).toMatchObject({
      type: "raster",
      tiles: [tms.tiles.urlTemplate],
      scheme: "tms",
      minzoom: 8,
      maxzoom: 18,
      tileSize: 256,
      attribution: "konjaku-test attribution",
    });
    expect(map.getLayersOrder()).toEqual([
      "background",
      "gsi-pale",
      pastLayerId(tms.id),
      "road-label",
      "chronomap-poi-pins",
      "chronomap-user-accuracy",
    ]);
    expect(layer?.paint).toEqual({ "raster-opacity": 0, "raster-fade-duration": 0 });

    scheduler.flush(0);
    scheduler.flush(250);
    expect(map.getLayer(pastLayerId(tms.id))?.paint?.["raster-opacity"]).toBe(0.6);
  });

  it("supersedes a fade and never leaves the intermediate source behind", () => {
    const a = entry("era-a");
    const b = entry("era-b");
    const c = entry("era-c");
    const { manager, map, scheduler } = setup();

    manager.setLayer(a, 1);
    scheduler.flush(0);
    scheduler.flush(250);
    manager.setLayer(b, 1);
    expect(pastSources(map)).toEqual([pastSourceId(a.id), pastSourceId(b.id)]);

    manager.setLayer(c, 1);
    expect(pastSources(map)).toEqual([pastSourceId(a.id), pastSourceId(c.id)]);
    expect(map.getLayer(pastLayerId(b.id))).toBeUndefined();

    scheduler.flush(250);
    scheduler.flush(500);
    expect(pastSources(map)).toEqual([pastSourceId(c.id)]);
    expect(pastLayers(map).map(({ id }) => id)).toEqual([pastLayerId(c.id)]);
  });

  it("subscribes to active layer and opacity, and removes a null layer", () => {
    const a = entry("era-a");
    const state = createInitialState(new Date(2026, 0, 1));
    state.timeLayer.activeLayerId = a.id;
    const { manager, map, store, scheduler } = setup([a], state);

    scheduler.flush(0);
    scheduler.flush(250);
    store.set((current) => ({
      ...current,
      timeLayer: { ...current.timeLayer, opacity: 0.35 },
    }));
    expect(map.getLayer(pastLayerId(a.id))?.paint?.["raster-opacity"]).toBe(0.35);

    store.set((current) => ({
      ...current,
      timeLayer: { ...current.timeLayer, activeLayerId: null },
    }));
    expect(pastSources(map)).toEqual([]);
    expect(pastLayers(map)).toEqual([]);
    manager.destroy();
  });

  it("skips rAF when reduced motion is enabled", () => {
    const { map, scheduler } = setup();
    const manager = createOverlayManager(
      {
        getMap: () => map,
        getViewportBbox: () => [128, 30, 146.5, 45.8],
        onIdle: () => () => undefined,
      } as unknown as MapController,
      createStore(createInitialState(new Date(2026, 0, 1))),
      [],
      { scheduler, prefersReducedMotion: () => true, debug: false },
    );

    manager.setLayer(entry("reduced"), 0.4);
    expect(scheduler.pendingCount()).toBe(0);
    expect(map.getLayer(pastLayerId("reduced"))?.paint?.["raster-opacity"]).toBe(0.4);
    manager.destroy();
  });

  it("logs only owned AJAX tile errors in debug mode", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const { manager, map } = setup();
    manager.setLayer(entry("debug-era"), 1);

    map.emit("error", {
      sourceId: pastSourceId("debug-era"),
      error: { status: 404, url: "https://tiles.example/debug-era/1/1/1.png" },
    });
    map.emit("error", {
      sourceId: "gsi-pale",
      error: { status: 404, url: "https://tiles.example/base/1/1/1.png" },
    });

    expect(debug).not.toHaveBeenCalled();
    manager.destroy();
  });

  it("tears down subscriptions, listeners, and rAF idempotently", () => {
    const a = entry("teardown-era");
    const { manager, map, store, scheduler } = setup([a]);
    manager.setLayer(a, 1);
    expect(scheduler.pendingCount()).toBe(1);
    expect(map.listeners.get("error")?.size).toBe(1);
    expect(map.listeners.get("load")?.size).toBe(1);

    manager.destroy();
    manager.destroy();
    expect(scheduler.pendingCount()).toBe(0);
    expect(map.listeners.get("error")?.size).toBe(0);
    expect(map.listeners.get("load")?.size).toBe(0);
    expect(pastSources(map)).toEqual([]);
    expect(pastLayers(map)).toEqual([]);

    store.set((current) => ({
      ...current,
      timeLayer: { ...current.timeLayer, activeLayerId: a.id },
    }));
    expect(pastSources(map)).toEqual([]);
  });
});

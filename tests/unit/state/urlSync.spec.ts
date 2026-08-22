import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { initUrlSync } from "../../../src/state/urlSync";

const NOW = new Date(2026, 0, 1);
const REGISTRY_IDS = new Set(["gsi-1960"]);

function resetLocation(search = ""): void {
  window.history.replaceState(null, "", `/${search}`);
}

function createTestStore() {
  return createStore(createInitialState(NOW));
}

describe("initUrlSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLocation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetLocation();
  });

  it("applies a deep link before callers construct the map", () => {
    resetLocation("?lat=34.7025&lng=135.4959&z=16&year=1965&l=gsi-1960&op=60&poi=0");
    const store = createTestStore();
    const sync = initUrlSync(store, REGISTRY_IDS, { now: NOW });

    expect(store.get()).toMatchObject({
      view: { lat: 34.7025, lng: 135.4959, zoom: 16 },
      year: 1965,
      requestedLayerId: "gsi-1960",
      timeLayer: { opacity: 0.6 },
      poi: { enabled: false },
    });
    expect(sync.getSerialized()).toBe(
      "?lat=34.7025&lng=135.4959&z=16&year=1965&l=gsi-1960&op=60&poi=0",
    );

    sync.destroy();
  });

  it("holds URL writes until the first idle event", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const store = createTestStore();
    const sync = initUrlSync(store, REGISTRY_IDS, { now: NOW });
    const actions = createActions(store);

    actions.setView({ lat: 35, lng: 139, zoom: 12 });
    vi.advanceTimersByTime(1_000);
    expect(replaceState).not.toHaveBeenCalled();

    sync.markIdle();
    actions.setView({ lat: 35, lng: 139, zoom: 12 });
    vi.advanceTimersByTime(499);
    expect(replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(replaceState).toHaveBeenCalledWith(null, "", "?lat=35&lng=139&z=12");

    sync.destroy();
  });

  it("collapses continuous camera changes into one replaceState after silence", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const store = createTestStore();
    const sync = initUrlSync(store, REGISTRY_IDS, { now: NOW });
    const actions = createActions(store);
    sync.markIdle();

    for (let index = 0; index < 4; index += 1) {
      actions.setView({ lat: 35 + index / 100, lng: 139, zoom: 12 });
      vi.advanceTimersByTime(499);
    }

    expect(replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(replaceState).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("?lat=35.03&lng=139&z=12");

    sync.destroy();
  });

  it("serializes year, opacity, and POI changes through replaceState only", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");
    const store = createTestStore();
    const sync = initUrlSync(store, REGISTRY_IDS, { now: NOW });
    const actions = createActions(store);
    const historyLength = window.history.length;
    sync.markIdle();

    actions.setYear(1965, NOW);
    actions.setOpacity(60);
    store.set((state) => ({ ...state, poi: { ...state.poi, enabled: false } }));
    vi.advanceTimersByTime(500);

    expect(replaceState).toHaveBeenCalledOnce();
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(historyLength);
    expect(window.location.search).toBe("?year=1965&op=60&poi=0");

    sync.destroy();
  });

  it("does not rewrite an already canonical query", () => {
    resetLocation("?lat=35&lng=139&z=12");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const store = createTestStore();
    const sync = initUrlSync(store, REGISTRY_IDS, { now: NOW });
    const actions = createActions(store);
    sync.markIdle();

    actions.setView({ lat: 35, lng: 139, zoom: 12 });
    vi.advanceTimersByTime(500);

    expect(replaceState).not.toHaveBeenCalled();
    sync.destroy();
  });

  it("connects to an idle source and cancels pending work on destroy", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const unsubscribeIdle = vi.fn();
    let idleCallback: () => void = () => undefined;
    const register = vi.fn((callback: () => void) => {
      idleCallback = callback;
      return unsubscribeIdle;
    });
    const store = createTestStore();
    const sync = initUrlSync(store, REGISTRY_IDS, { now: NOW });

    sync.connectIdle(register);
    expect(register).toHaveBeenCalledOnce();
    idleCallback();
    createActions(store).setYear(1965, NOW);
    sync.destroy();
    sync.destroy();
    vi.advanceTimersByTime(500);

    expect(unsubscribeIdle).toHaveBeenCalledOnce();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

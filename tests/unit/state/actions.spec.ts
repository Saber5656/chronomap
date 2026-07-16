import { describe, expect, it } from "vitest";

import { createActions } from "../../../src/state/actions";
import { createInitialState, type Poi } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

function setup() {
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  return { store, actions: createActions(store) };
}

function poi(id: string): Poi {
  return {
    id,
    title: id,
    lat: 35,
    lng: 139,
    source: { provider: "wikipedia", lang: "ja", url: "https://ja.wikipedia.org/" },
  };
}

describe("createActions", () => {
  it("validates and clamps view, year, and opacity updates", () => {
    const { store, actions } = setup();
    actions.setView({ lat: 91, lng: -181, zoom: 30 });
    actions.setYear(1800, new Date(2026, 0, 1));
    actions.setOpacity(60);
    expect(store.get().view).toEqual({ lat: 90, lng: -180, zoom: 18 });
    expect(store.get().year).toBe(1890);
    expect(store.get().timeLayer.opacity).toBe(0.6);
  });

  it("ignores invalid numeric updates", () => {
    const { store, actions } = setup();
    actions.setView({ lat: Number.NaN, lng: 0, zoom: 5 });
    actions.setYear(Number.NaN);
    actions.setOpacity(Number.NaN);
    expect(store.get()).toEqual(createInitialState(new Date(2026, 0, 1)));
  });

  it("sets the active layer and optional resolution", () => {
    const { store, actions } = setup();
    actions.setActiveLayer("gsi-1960", {
      candidates: ["gsi-1960"],
      reason: "ok",
    });
    expect(store.get().timeLayer).toMatchObject({
      activeLayerId: "gsi-1960",
      resolution: { candidates: ["gsi-1960"], reason: "ok" },
    });
    actions.setActiveLayer(null);
    expect(store.get().timeLayer.resolution.reason).toBe("ok");
  });

  it("updates POI status, items, selection, and enforces POI_MAX", () => {
    const { store, actions } = setup();
    actions.setPoiStatus("ready");
    actions.setPoiItems([poi("selected")]);
    actions.selectPoi("selected");
    actions.setPoiItems(Array.from({ length: 55 }, (_, index) => poi(String(index))));
    expect(store.get().poi.status).toBe("ready");
    expect(store.get().poi.items).toHaveLength(50);
    expect(store.get().poi.selectedId).toBeNull();
  });

  it("preserves a selected POI that remains in the result", () => {
    const { store, actions } = setup();
    actions.setPoiItems([poi("a"), poi("b")]);
    actions.selectPoi("b");
    actions.setPoiItems([poi("b"), poi("c")]);
    expect(store.get().poi.selectedId).toBe("b");
  });

  it("rejects a selected POI that is absent from the current items", () => {
    const { store, actions } = setup();
    actions.setPoiItems([poi("present")]);
    actions.selectPoi("missing");
    expect(store.get().poi.selectedId).toBeNull();
  });

  it("updates geolocation status and validated fixes", () => {
    const { store, actions } = setup();
    actions.setGeoStatus("granted");
    actions.setFix({ lat: 91, lng: 181, accuracyM: 8, at: 123 });
    expect(store.get().geo).toEqual({
      status: "granted",
      fix: { lat: 90, lng: 180, accuracyM: 8, at: 123 },
    });
    actions.setFix(null);
    expect(store.get().geo.fix).toBeNull();
  });

  it("rejects invalid geolocation fixes", () => {
    const { store, actions } = setup();
    actions.setFix({ lat: Number.NaN, lng: 0, accuracyM: 1, at: 1 });
    actions.setFix({ lat: 0, lng: 0, accuracyM: -1, at: 1 });
    actions.setFix({ lat: 0, lng: 0, accuracyM: 1, at: Number.NaN });
    expect(store.get().geo.fix).toBeNull();
  });

  it("opens and closes sheets", () => {
    const { store, actions } = setup();
    actions.openSheet("layers");
    expect(store.get().ui.sheet).toBe("layers");
    actions.closeSheet();
    expect(store.get().ui.sheet).toBe("none");
  });

  it("creates monotonic toasts and changes language", () => {
    const { store, actions } = setup();
    actions.showToast("info", "first");
    actions.showToast("error", "second");
    actions.setLang("en");
    expect(store.get().ui.toast).toEqual({ id: 2, kind: "error", text: "second" });
    expect(store.get().ui.lang).toBe("en");
  });

  it("continues toast ids from existing state", () => {
    const initial = createInitialState(new Date(2026, 0, 1));
    initial.ui.toast = { id: 7, kind: "info", text: "existing" };
    const store = createStore(initial);
    const actions = createActions(store);
    actions.showToast("info", "next");
    expect(store.get().ui.toast?.id).toBe(8);
  });

  it("shares monotonic toast ids across action instances", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const first = createActions(store);
    const second = createActions(store);
    first.showToast("info", "first");
    second.showToast("error", "second");
    expect(store.get().ui.toast).toEqual({ id: 2, kind: "error", text: "second" });
  });
});

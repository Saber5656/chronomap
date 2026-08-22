import { describe, expect, it } from "vitest";

import { createTimeWiring } from "../../../src/app/timeWiring";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import type { LayerEntry } from "../../../src/providers/layers/types";

const LAYER_BASE: Omit<LayerEntry, "id" | "title" | "era"> = {
  type: "raster-era",
  provider: "test",
  region: "JP",
  coverage: [[139, 35, 140, 36]],
  tiles: {
    urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/test/{z}/{x}/{y}.png",
    scheme: "xyz",
    minzoom: 0,
    maxzoom: 22,
    tileSize: 256,
  },
  attribution: { text: "test", license: { name: "test" } },
  flags: { experimental: false, requiresFeatureFlag: null },
  priority: 0,
};

function layer(id: string, from: number, to: number): LayerEntry {
  return {
    ...LAYER_BASE,
    id,
    title: { ja: id, en: id },
    era: { from, to },
  };
}

describe("createTimeWiring", () => {
  it("resolves initial, year, and view changes into timeLayer state", async () => {
    const initial = createInitialState(new Date(2026, 0, 1));
    initial.view = { lat: 35.5, lng: 139.5, zoom: 14 };
    initial.year = 1965;
    const store = createStore(initial);
    const actions = createActions(store);
    let bbox: readonly [number, number, number, number] = [139.1, 35.1, 139.9, 35.9];
    const map = { getViewportBbox: () => bbox };
    const wiring = createTimeWiring(
      store,
      map,
      [layer("old", 1961, 1969), layer("recent", 2000, 2026)],
      { currentYear: 2026 },
    );

    expect(store.get().timeLayer).toMatchObject({
      activeLayerId: "old",
      disabled: false,
      resolution: { candidates: ["old", "recent"], reason: "ok" },
    });

    actions.setYear(2010);
    await Promise.resolve();
    expect(store.get().timeLayer.activeLayerId).toBe("recent");

    bbox = [150, 40, 151, 41];
    actions.setView({ lat: 40.5, lng: 150.5, zoom: 14 });
    await Promise.resolve();
    expect(store.get().timeLayer).toMatchObject({
      activeLayerId: null,
      disabled: false,
      resolution: { candidates: [], reason: "no-coverage" },
    });

    wiring.destroy();
    actions.setYear(1965);
    await Promise.resolve();
    expect(store.get().timeLayer.activeLayerId).toBeNull();
  });

  it("reports an empty registry without involving the slider or map overlay", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const map = { getViewportBbox: () => [139, 35, 140, 36] as const };
    const wiring = createTimeWiring(store, map, [], { currentYear: 2026 });

    expect(wiring.resolveNow()).toMatchObject({
      activeLayerId: null,
      reason: "registry-empty",
      candidates: [],
    });
    expect(store.get().timeLayer.resolution.reason).toBe("registry-empty");
    expect(store.get().timeLayer.disabled).toBe(true);
    wiring.destroy();
  });
});

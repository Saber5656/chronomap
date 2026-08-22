import { describe, expect, it } from "vitest";

import type { LayerEntry } from "../../../src/providers/layers/types";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { mount } from "../../../src/ui/components/LayerInfoBadge";

function layer(): LayerEntry {
  return {
    id: "gsi-test-1961",
    type: "raster-era",
    provider: "gsi",
    title: { ja: "空中写真 1961–1969年", en: "Aerial photos 1961–1969" },
    era: { from: 1961, to: 1969 },
    region: "JP",
    coverage: [[139, 35, 140, 36]],
    tiles: {
      urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/test/{z}/{x}/{y}.png",
      scheme: "xyz",
      minzoom: 0,
      maxzoom: 22,
      tileSize: 256,
    },
    attribution: { text: "registry attribution", license: { name: "registry license" } },
    flags: { experimental: false, requiresFeatureFlag: null },
    priority: 0,
  };
}

describe("LayerInfoBadge", () => {
  it("uses the present-day fallback and updates from one active-layer notification", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const parent = document.createElement("div");
    const controller = mount(parent, store, { registry: [layer()] });
    const badge = parent.querySelector<HTMLButtonElement>(".layer-info-badge");
    if (badge === null) throw new Error("Expected the layer badge.");

    expect(badge.textContent).toBe("現在の地図");
    expect(badge.dataset.layerId).toBe("present-day");

    createActions(store).setActiveLayer("gsi-test-1961");
    expect(badge.textContent).toBe("1961–1969 · 空中写真 1961–1969年");
    expect(badge.dataset.layerId).toBe("gsi-test-1961");

    badge.click();
    expect(store.get().ui.sheet).toBe("layers");
    controller.destroy();
  });

  it("renders the selected locale without polling", () => {
    const initial = createInitialState(new Date(2026, 0, 1));
    initial.timeLayer.activeLayerId = "gsi-test-1961";
    const store = createStore(initial);
    const parent = document.createElement("div");
    const controller = mount(parent, store, { registry: [layer()] });
    const badge = parent.querySelector<HTMLButtonElement>(".layer-info-badge");

    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "en" } }));
    expect(badge?.textContent).toBe("1961–1969 · Aerial photos 1961–1969");
    controller.destroy();
  });
});

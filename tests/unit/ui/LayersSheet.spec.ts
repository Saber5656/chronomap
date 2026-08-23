import { describe, expect, it } from "vitest";

import type { LayerEntry } from "../../../src/providers/layers/types";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { mount } from "../../../src/ui/components/LayersSheet";

function layer(experimental = false): LayerEntry {
  return {
    id: "konjaku-test-1961",
    type: "raster-era",
    provider: "registry-provider",
    title: { ja: "登録レイヤー 1961–1964年", en: "Registered layer 1961–1964" },
    era: { from: 1961, to: 1964 },
    region: "JP",
    coverage: [[139, 35, 140, 36]],
    tiles: {
      urlTemplate: "https://ktgis.net/kjmapw/kjtilemap/test/{z}/{x}/{y}.png",
      scheme: "tms",
      minzoom: 0,
      maxzoom: 22,
      tileSize: 256,
    },
    attribution: {
      text: "verbatim registry attribution",
      url: "https://provider.example/attribution",
      license: {
        name: "verbatim registry license",
        url: "https://provider.example/license",
      },
    },
    flags: { experimental, requiresFeatureFlag: experimental ? "VITE_ENABLE_TEST" : null },
    priority: 0,
  };
}

function setup(activeLayerId: string | null = null) {
  const initial = createInitialState(new Date(2026, 0, 1));
  initial.timeLayer.activeLayerId = activeLayerId;
  const store = createStore(initial);
  const parent = document.createElement("div");
  const controller = mount(parent, store, {
    registry: [layer(true)],
    basemap: {
      id: "gsi-pale",
      title: { ja: "GSI 淡色地図", en: "GSI pale" },
      attribution: {
        text: "地理院タイル（国土地理院）",
        url: "https://maps.gsi.go.jp/development/ichiran.html",
      },
    },
    poiSource: {
      id: "wikipedia",
      title: { ja: "Wikipedia", en: "Wikipedia" },
      attribution: {
        text: "Wikipedia (CC BY-SA)",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
    },
  });
  return { parent, store, controller };
}

describe("LayersSheet", () => {
  it("shows basemap and POI sources without an active past layer", () => {
    const { parent, controller } = setup();

    expect(parent.querySelectorAll("[data-layer-row]")).toHaveLength(2);
    expect(parent.querySelector("[data-layer-row='basemap']")?.textContent).toContain(
      "GSI 淡色地図",
    );
    expect(parent.querySelector("[data-layer-row='active-layer']")).toBeNull();
    expect(parent.querySelector("[data-layer-row='poi']")?.textContent).toContain(
      "Wikipedia (CC BY-SA)",
    );
    controller.destroy();
  });

  it("renders registry attribution and license text verbatim with safe external links", () => {
    const { parent, controller } = setup("konjaku-test-1961");
    const activeRow = parent.querySelector<HTMLElement>("[data-layer-row='active-layer']");
    const links = [...(activeRow?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];

    expect(activeRow?.textContent).toContain("verbatim registry attribution");
    expect(activeRow?.textContent).toContain("verbatim registry license");
    expect(activeRow?.textContent).toContain("registry-provider");
    expect(activeRow?.querySelector("[data-chip='experimental']")?.textContent).toBe("実験的");
    expect(links.map((link) => link.href)).toEqual([
      "https://provider.example/attribution",
      "https://provider.example/license",
    ]);
    for (const link of links) {
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener noreferrer");
    }

    controller.destroy();
  });

  it("updates the active row and language through store subscriptions", () => {
    const { parent, store, controller } = setup();
    expect(parent.querySelector("[data-layer-row='active-layer']")).toBeNull();

    createActions(store).setActiveLayer("konjaku-test-1961");
    expect(parent.querySelector("[data-layer-row='active-layer']")?.textContent).toContain(
      "登録レイヤー 1961–1964年",
    );
    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "en" } }));
    expect(parent.querySelector("[data-layer-row='active-layer']")?.textContent).toContain(
      "Registered layer 1961–1964",
    );
    controller.destroy();
  });

  it("opens the About sheet from the enabled footer link", () => {
    const { parent, store, controller } = setup();
    const aboutLink = parent.querySelector<HTMLButtonElement>("[data-sheet-link='about']");

    expect(aboutLink).not.toBeNull();
    expect(aboutLink?.disabled).toBe(false);
    aboutLink?.click();
    expect(store.get().ui.sheet).toBe("about");

    controller.destroy();
  });
});

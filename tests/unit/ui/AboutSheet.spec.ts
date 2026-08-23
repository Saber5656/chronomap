import { afterEach, describe, expect, it } from "vitest";

import konjakuLayers from "../../../src/providers/layers/konjaku.layers.json";
import type { LayerEntry } from "../../../src/providers/layers/types";
import { loadRegistry } from "../../../src/providers/layers/loader";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { collectRegistryDataSources, mount } from "../../../src/ui/components/AboutSheet";
import { initI18n } from "../../../src/ui/i18n";

function layer(provider: string, credit: string, license = "Provider terms"): LayerEntry {
  return {
    id: `${provider}-test`,
    type: "raster-era",
    provider,
    title: { ja: "テストレイヤー", en: "Test layer" },
    era: { from: 1961, to: 1964 },
    region: "JP",
    coverage: [[139, 35, 140, 36]],
    tiles: {
      urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/test/{z}/{x}/{y}.png",
      scheme: "xyz",
      minzoom: 0,
      maxzoom: 22,
      tileSize: 256,
    },
    attribution: {
      text: credit,
      url: "https://provider.example/credit",
      license: { name: license, url: "https://provider.example/license" },
    },
    flags: { experimental: false, requiresFeatureFlag: null },
    priority: 0,
  };
}

function poiSource() {
  return {
    id: "wikipedia",
    title: { ja: "Wikipedia", en: "Wikipedia" },
    attribution: {
      text: "Wikipedia (CC BY-SA)",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    license: {
      text: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("AboutSheet", () => {
  it("groups registry credits and retains a fixture provider row", () => {
    const sources = collectRegistryDataSources([
      layer("gsi", "GSI historical credit"),
      layer("gsi", "GSI present credit"),
      layer("fixture-provider", "Fixture credit"),
    ]);

    expect(sources.map((source) => source.provider)).toEqual(["gsi", "fixture-provider"]);
    expect(sources[0]?.credits.map((credit) => credit.text)).toEqual([
      "GSI historical credit",
      "GSI present credit",
    ]);
    expect(sources[1]?.credits[0]?.text).toBe("Fixture credit");
  });

  it("omits the permission-gated Konjaku source when its flag is off", () => {
    const disabled = loadRegistry(konjakuLayers, {
      currentYear: 2026,
      featureFlags: {},
      warn: () => undefined,
    });
    const enabled = loadRegistry(konjakuLayers, {
      currentYear: 2026,
      featureFlags: { VITE_ENABLE_KONJAKU: "true" },
      warn: () => undefined,
    });

    expect(collectRegistryDataSources(disabled)).toEqual([]);
    expect(collectRegistryDataSources(enabled).map((source) => source.provider)).toEqual([
      "konjaku",
    ]);
  });

  it("renders source rows, privacy disclosures, safe links, and English parity", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "ja" } }));
    const parent = document.createElement("div");
    const controller = mount(parent, store, {
      registry: [layer("fixture-provider", "Fixture credit", "Fixture license")],
      poiSource: poiSource(),
    });

    expect(parent.querySelector(".about-sheet__app-name")?.textContent).toBe("chronomap");
    expect(parent.querySelector("[data-about-section='app']")?.textContent).toContain("0.1.0");
    expect(parent.querySelector("[data-source-row='fixture-provider']")?.textContent).toContain(
      "Fixture credit",
    );
    expect(parent.querySelector("[data-source-row='fixture-provider']")?.textContent).toContain(
      "Fixture license",
    );
    expect(parent.querySelector("[data-source-row='poi']")?.textContent).toContain(
      "Wikipedia (CC BY-SA)",
    );
    expect(parent.querySelector("[data-source-row='poi']")?.textContent).toContain("CC BY-SA 4.0");
    expect(parent.textContent).toContain("chronomap.lang");
    expect(parent.textContent).toContain("chronomap.onboarded");
    expect(parent.textContent).toContain("CacheStorage");
    expect(parent.textContent).toContain("第三者サービス");
    expect(parent.textContent).toContain("国土地理院（GSI）");
    expect(parent.textContent).toContain("中心座標");
    expect(parent.textContent).toContain("Cookie");
    expect(parent.textContent).toContain("トラッキング");

    const links = [...parent.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links.length).toBeGreaterThanOrEqual(6);
    for (const link of links) {
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener noreferrer");
    }
    expect(parent.querySelector("[data-about-link='license']")?.getAttribute("href")).toBe(
      "https://github.com/Saber5656/chronomap/blob/main/LICENSE",
    );
    expect(parent.querySelector("[data-about-link='shortcut']")?.getAttribute("href")).toBe(
      "https://github.com/Saber5656/chronomap/blob/main/docs/integrations/ios-shortcut.md",
    );

    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "en" } }));
    expect(parent.querySelector("[data-about-section='sources']")?.textContent).toContain(
      "Data sources",
    );
    expect(parent.textContent).toContain("The only localStorage keys saved");

    controller.destroy();
    i18n.destroy();
  });
});

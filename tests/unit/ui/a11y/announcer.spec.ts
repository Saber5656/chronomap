import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LayerEntry } from "../../../../src/providers/layers/types";
import { createActions } from "../../../../src/state/actions";
import { createInitialState } from "../../../../src/state/appState";
import { createStore } from "../../../../src/state/store";
import { A11Y_ANNOUNCE_DEBOUNCE_MS, mountA11yAnnouncer } from "../../../../src/ui/a11y/announcer";

const OLD_LAYER: LayerEntry = {
  id: "old",
  type: "raster-era",
  provider: "test",
  title: { ja: "1960年画像", en: "1960 imagery" },
  era: { from: 1960, to: 1969 },
  region: "JP",
  coverage: [[139, 35, 140, 36]],
  tiles: {
    urlTemplate: "https://example.test/tiles/{z}/{x}/{y}.png",
    scheme: "xyz",
    minzoom: 0,
    maxzoom: 22,
    tileSize: 256,
  },
  attribution: { text: "Test", license: { name: "Test" } },
  flags: { experimental: false, requiresFeatureFlag: null },
  priority: 0,
};

const NEW_LAYER: LayerEntry = {
  ...OLD_LAYER,
  id: "new",
  title: { ja: "1970年画像", en: "1970 imagery" },
  era: { from: 1970, to: 1979 },
};

describe("a11y announcer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  function setup() {
    const initial = createInitialState(new Date(2026, 0, 1));
    initial.year = 1965;
    initial.timeLayer = {
      activeLayerId: OLD_LAYER.id,
      opacity: 1,
      disabled: false,
      resolution: { candidates: [OLD_LAYER.id], reason: "ok", snapped: false },
    };
    const store = createStore(initial);
    const parent = document.createElement("main");
    document.body.append(parent);
    const controller = mountA11yAnnouncer(parent, store, {
      registry: [OLD_LAYER, NEW_LAYER],
    });
    const root = parent.querySelector<HTMLElement>("[data-a11y-announcer='true']");
    const yearMessage = parent.querySelector<HTMLElement>("[data-a11y-year-announcement='true']");
    const layerMessage = parent.querySelector<HTMLElement>("[data-a11y-layer-announcement='true']");
    if (root === null || yearMessage === null || layerMessage === null) {
      throw new Error("Expected the mounted live region.");
    }
    return { controller, layerMessage, parent, root, store, yearMessage };
  }

  it("debounces year changes and keeps the settled slider value text", () => {
    const { controller, parent, root, store, yearMessage } = setup();
    const slider = document.createElement("div");
    slider.setAttribute("aria-valuetext", "1966年 — 1960年画像");
    parent.append(slider);

    slider.dispatchEvent(
      new CustomEvent("yearchange", {
        bubbles: true,
        detail: { year: 1966 },
      }),
    );
    createActions(store).setYear(1966, new Date(2026, 0, 1));

    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-live")).toBe("polite");
    expect(yearMessage.textContent).toBe("");
    vi.advanceTimersByTime(A11Y_ANNOUNCE_DEBOUNCE_MS - 1);
    expect(yearMessage.textContent).toBe("");
    vi.advanceTimersByTime(1);
    expect(yearMessage.textContent).toBe("1966年 — 1960年画像");

    slider.setAttribute("aria-valuetext", "1967年 — 1960年画像");
    slider.dispatchEvent(
      new CustomEvent("yearchange", {
        bubbles: true,
        detail: { year: 1967 },
      }),
    );
    createActions(store).setYear(1967, new Date(2026, 0, 1));
    vi.advanceTimersByTime(A11Y_ANNOUNCE_DEBOUNCE_MS);
    expect(yearMessage.textContent).toBe("1967年 — 1960年画像");
    controller.destroy();
  });

  it("waits for a stale slider value text to settle before announcing", () => {
    const { controller, parent, store, yearMessage } = setup();
    const slider = document.createElement("div");
    slider.setAttribute("aria-valuetext", "1965年 — 1960年画像");
    parent.append(slider);

    slider.dispatchEvent(
      new CustomEvent("yearchange", {
        bubbles: true,
        detail: { year: 1966 },
      }),
    );
    createActions(store).setYear(1966, new Date(2026, 0, 1));

    vi.advanceTimersByTime(A11Y_ANNOUNCE_DEBOUNCE_MS);
    expect(yearMessage.textContent).toBe("");

    slider.setAttribute("aria-valuetext", "1966年 — 1960年画像");
    vi.advanceTimersByTime(16);
    expect(yearMessage.textContent).toBe("1966年 — 1960年画像");
    controller.destroy();
  });

  it("announces a resolved layer change without announcing the initial layer", () => {
    const { controller, layerMessage, store } = setup();
    expect(layerMessage.textContent).toBe("");

    createActions(store).setActiveLayer(NEW_LAYER.id, {
      candidates: [NEW_LAYER.id],
      reason: "ok",
      snapped: false,
    });
    expect(layerMessage.textContent).toBe("表示レイヤーが 1970年画像 に変わりました");

    controller.destroy();
  });

  it("announces the present-day state when the historical layer is cleared", () => {
    const { controller, layerMessage, store } = setup();

    createActions(store).setActiveLayer(null, {
      candidates: [],
      reason: "no-coverage",
      snapped: false,
    });

    expect(layerMessage.textContent).toBe("現在の地図");
    controller.destroy();
  });
});

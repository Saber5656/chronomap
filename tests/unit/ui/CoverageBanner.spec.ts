import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COVERAGE_BANNER_HYSTERESIS_MS,
  mountCoverageBanner,
  selectNearbyEra,
  SNAPPED_BADGE_DURATION_MS,
} from "../../../src/ui/components/CoverageBanner";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import type { LayerEntry } from "../../../src/providers/layers/types";

const VIEW_BBOX = [0, 0, 1, 1] as const;

function layer(
  id: string,
  from: number,
  to: number,
  coverage: readonly [number, number, number, number],
  type: LayerEntry["type"] = "raster-era",
): LayerEntry {
  return {
    id,
    type,
    provider: "test",
    title: { ja: `${id}画像`, en: `${id} imagery` },
    era: { from, to },
    region: "JP",
    coverage: [coverage],
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
}

function setup() {
  const initial = createInitialState(new Date(2026, 0, 1));
  initial.year = 1930;
  initial.timeLayer = {
    activeLayerId: null,
    opacity: 1,
    disabled: false,
    resolution: { candidates: [], reason: "no-coverage", snapped: false },
  };
  const store = createStore(initial);
  const mapController = {
    getViewportBbox: vi.fn(() => VIEW_BBOX),
    flyTo: vi.fn(),
  };
  const registry = [
    layer("near", 1936, 1942, [2, 0, 3, 1]),
    layer("vector", 1930, 1930, [2, 0, 3, 1], "vector-dated"),
  ];
  const parent = document.createElement("div");
  document.body.append(parent);
  const controller = mountCoverageBanner(parent, store, {
    mapController,
    registry,
    now: new Date(2026, 0, 1),
  });
  const root = parent.querySelector<HTMLElement>(".coverage-banner");
  if (root === null) throw new Error("Expected CoverageBanner root.");
  return { controller, mapController, parent, registry, root, store };
}

describe("selectNearbyEra", () => {
  it("selects the nearest era whose coverage intersects the expanded viewport", () => {
    const nearest = layer("nearest", 1936, 1942, [2, 0, 3, 1]);
    const later = layer("later", 1950, 1954, [1.2, 0, 2.2, 1]);
    const vector = layer("vector", 1930, 1930, [0, 0, 1, 1], "vector-dated");

    const result = selectNearbyEra([nearest, later, vector], VIEW_BBOX, 1930);

    expect(result).toMatchObject({
      entry: nearest,
      year: 1939,
      bbox: [2, 0, 3, 1],
      center: { lng: 2.5, lat: 0.5 },
    });
  });

  it("returns null when no era intersects the expanded viewport", () => {
    expect(selectNearbyEra([layer("far", 1930, 1930, [5, 5, 6, 6])], VIEW_BBOX, 1930)).toBeNull();
  });

  it("keeps resolver tie-breaking for era span, priority, and id", () => {
    const wide = layer("wide", 1936, 1946, [2, 0, 3, 1]);
    const highPriority = { ...layer("high", 1936, 1942, [2, 0, 3, 1]), priority: 9 };
    const lowId = { ...layer("a-low-id", 1936, 1942, [2, 0, 3, 1]), priority: 1 };
    const highId = { ...layer("z-high-id", 1936, 1942, [2, 0, 3, 1]), priority: 1 };

    expect(selectNearbyEra([wide, lowId], VIEW_BBOX, 1930)?.entry.id).toBe("a-low-id");
    expect(selectNearbyEra([highPriority, lowId, highId], VIEW_BBOX, 1930)?.entry.id).toBe("high");
    expect(selectNearbyEra([lowId, highId], VIEW_BBOX, 1930)?.entry.id).toBe("a-low-id");
  });

  it("uses the closest intersecting coverage bbox for a multi-region era", () => {
    const entry = {
      ...layer("multi", 1936, 1942, [2, 0, 3, 1]),
      coverage: [
        [2, 0, 3, 1],
        [0.9, 0, 1.1, 1],
      ] as const,
    };

    expect(selectNearbyEra([entry], VIEW_BBOX, 1930)?.bbox).toEqual([0.9, 0, 1.1, 1]);
  });
});

describe("CoverageBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("delays coverage transitions and hides the snapped badge after four seconds", () => {
    const { controller, root, store } = setup();
    const actions = createActions(store);

    expect(root.hidden).toBe(true);
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS - 1);
    expect(root.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(root.dataset.state).toBe("no-coverage");
    expect(root.textContent).toContain("1939年代の画像が近くにあります");

    actions.setActiveLayer("near", {
      candidates: ["near"],
      reason: "ok",
      snapped: true,
    });
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS);
    expect(root.dataset.state).toBe("snapped");
    expect(root.textContent).toContain("near画像");

    vi.advanceTimersByTime(SNAPPED_BADGE_DURATION_MS - 1);
    expect(root.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(root.hidden).toBe(true);

    actions.setYear(1931, new Date(2026, 0, 1));
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS);
    expect(root.dataset.state).toBe("snapped");

    controller.destroy();
  });

  it("cancels a pending transition when a coverage edge is crossed back quickly", () => {
    const { controller, root, store } = setup();
    const actions = createActions(store);
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS);
    expect(root.dataset.state).toBe("no-coverage");

    actions.setActiveLayer("near", {
      candidates: ["near"],
      reason: "ok",
      snapped: false,
    });
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS / 2);
    actions.setActiveLayer(null, {
      candidates: [],
      reason: "no-coverage",
      snapped: false,
    });
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS);

    expect(root.dataset.state).toBe("no-coverage");
    expect(root.textContent).toContain("1939年代の画像が近くにあります");
    controller.destroy();
  });

  it("shows the registry error state without exposing a chip", () => {
    const { controller, root, store } = setup();
    const actions = createActions(store);
    actions.setActiveLayer(null, {
      candidates: [],
      reason: "registry-empty",
      snapped: false,
    });
    vi.advanceTimersByTime(COVERAGE_BANNER_HYSTERESIS_MS);

    expect(root.dataset.state).toBe("registry-error");
    expect(root.querySelector("button")?.hidden).toBe(true);
    expect(root.textContent).toContain("地図画像の設定を読み込めませんでした");
    controller.destroy();
  });
});

import { describe, expect, it } from "vitest";

import gsiLayers from "../../../../src/providers/layers/gsi.layers.json";
import { loadRegistry } from "../../../../src/providers/layers/loader";
import { eraTicks, resolve } from "../../../../src/providers/layers/resolve";
import type { Bbox, LayerEntry } from "../../../../src/providers/layers/types";

const CURRENT_YEAR = 2026;
const JAPAN_BBOX: Bbox = [128, 30, 146.5, 45.8];
const TOKYO_BBOX: Bbox = [139.6, 35.6, 139.8, 35.75];
const OSAKA_BBOX: Bbox = [135.4, 34.6, 135.55, 34.75];

interface LayerOptions {
  readonly type?: LayerEntry["type"];
  readonly provider?: string;
  readonly coverage?: readonly Bbox[];
  readonly minzoom?: number;
  readonly maxzoom?: number;
  readonly priority?: number;
  readonly experimental?: boolean;
  readonly requiresFeatureFlag?: string | null;
}

function layer(id: string, from: number, to: number, options: LayerOptions = {}): LayerEntry {
  return {
    id,
    type: options.type ?? "raster-era",
    provider: options.provider ?? "synthetic",
    title: { ja: id, en: id },
    era: { from, to },
    region: "JP",
    coverage: options.coverage ?? [JAPAN_BBOX],
    tiles: {
      urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/test/{z}/{x}/{y}.png",
      scheme: "xyz",
      minzoom: options.minzoom ?? 0,
      maxzoom: options.maxzoom ?? 22,
      tileSize: 256,
    },
    attribution: { text: id, license: { name: "test" } },
    flags: {
      experimental: options.experimental ?? false,
      requiresFeatureFlag: options.requiresFeatureFlag ?? null,
    },
    priority: options.priority ?? 0,
  };
}

function resolveAt(
  registry: readonly LayerEntry[],
  year: number,
  viewBbox: Bbox = TOKYO_BBOX,
  zoom = 14,
  overrideId?: string,
) {
  return resolve({
    year,
    viewBbox,
    zoom,
    currentYear: CURRENT_YEAR,
    registry,
    ...(overrideId === undefined ? {} : { overrideId }),
  });
}

function loadedGsi(): LayerEntry[] {
  return loadRegistry(gsiLayers, {
    currentYear: CURRENT_YEAR,
    featureFlags: {},
    warn: () => undefined,
  });
}

describe("resolve", () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly registry: readonly LayerEntry[];
    readonly year: number;
    readonly viewBbox?: Bbox;
    readonly zoom?: number;
    readonly overrideId?: string;
    readonly expected: {
      readonly activeLayerId: string | null;
      readonly reason: "ok" | "no-coverage" | "registry-empty";
      readonly candidates: readonly string[];
      readonly snapped: boolean;
    };
  }> = [
    {
      name: "selects an era containing the requested year",
      registry: [layer("era-1900", 1900, 1910)],
      year: 1905,
      expected: {
        activeLayerId: "era-1900",
        reason: "ok",
        candidates: ["era-1900"],
        snapped: false,
      },
    },
    {
      name: "snaps to the nearest era when the year is between eras",
      registry: [layer("era-1930", 1930, 1930), layer("era-1940", 1940, 1940)],
      year: 1936,
      expected: {
        activeLayerId: "era-1940",
        reason: "ok",
        candidates: ["era-1940", "era-1930"],
        snapped: true,
      },
    },
    {
      name: "breaks an exact score tie with the smaller era span",
      registry: [layer("wide-era", 1934, 1936), layer("single-year", 1930, 1930)],
      year: 1932,
      expected: {
        activeLayerId: "single-year",
        reason: "ok",
        candidates: ["single-year", "wide-era"],
        snapped: true,
      },
    },
    {
      name: "breaks a span tie with higher priority",
      registry: [
        layer("low-priority", 1930, 1930, { priority: 1 }),
        layer("high-priority", 1930, 1930, { priority: 9 }),
      ],
      year: 1931,
      expected: {
        activeLayerId: "high-priority",
        reason: "ok",
        candidates: ["high-priority", "low-priority"],
        snapped: true,
      },
    },
    {
      name: "breaks a priority tie with ascending id",
      registry: [layer("zeta", 1930, 1930), layer("alpha", 1930, 1930)],
      year: 1931,
      expected: {
        activeLayerId: "alpha",
        reason: "ok",
        candidates: ["alpha", "zeta"],
        snapped: true,
      },
    },
    {
      name: "honors a valid raster override",
      registry: [layer("nearest", 1930, 1930), layer("forced", 1900, 1900)],
      year: 1930,
      overrideId: "forced",
      expected: {
        activeLayerId: "forced",
        reason: "ok",
        candidates: ["nearest", "forced"],
        snapped: true,
      },
    },
    {
      name: "ignores an unknown override",
      registry: [layer("nearest", 1930, 1930)],
      year: 1930,
      overrideId: "missing",
      expected: {
        activeLayerId: "nearest",
        reason: "ok",
        candidates: ["nearest"],
        snapped: false,
      },
    },
    {
      name: "ignores an override outside the viewport coverage",
      registry: [
        layer("nearest", 1930, 1930),
        layer("out-of-view", 1900, 1900, { coverage: [[140, 40, 141, 41]] }),
      ],
      year: 1930,
      overrideId: "out-of-view",
      expected: {
        activeLayerId: "nearest",
        reason: "ok",
        candidates: ["nearest"],
        snapped: false,
      },
    },
    {
      name: "ignores a vector-dated override",
      registry: [
        layer("nearest", 1930, 1930),
        layer("vector-only", 1900, 1900, { type: "vector-dated" }),
      ],
      year: 1930,
      overrideId: "vector-only",
      expected: {
        activeLayerId: "nearest",
        reason: "ok",
        candidates: ["nearest"],
        snapped: false,
      },
    },
    {
      name: "returns no coverage outside every bbox",
      registry: [layer("nearby", 1930, 1930)],
      year: 1930,
      viewBbox: [150, 40, 151, 41],
      expected: {
        activeLayerId: null,
        reason: "no-coverage",
        candidates: [],
        snapped: false,
      },
    },
    {
      name: "returns registry-empty for an empty registry",
      registry: [],
      year: 1930,
      expected: {
        activeLayerId: null,
        reason: "registry-empty",
        candidates: [],
        snapped: false,
      },
    },
    {
      name: "uses the normalized rolling era endpoint",
      registry: loadedGsi(),
      year: CURRENT_YEAR,
      viewBbox: TOKYO_BBOX,
      zoom: 14,
      expected: {
        activeLayerId: "gsi-seamlessphoto",
        reason: "ok",
        candidates: [
          "gsi-seamlessphoto",
          "gsi-gazo4",
          "gsi-gazo3",
          "gsi-gazo2",
          "gsi-gazo1",
          "gsi-ort-old10",
          "gsi-ort-usa10",
          "gsi-ort-riku10",
        ],
        snapped: false,
      },
    },
    {
      name: "prefers the present-day GSI photo in the recent-year window",
      registry: [
        layer("recent-specific", 2025, 2025, { provider: "gsi" }),
        layer("gsi-seamlessphoto", 1900, 1900, { provider: "gsi" }),
      ],
      year: 2025,
      expected: {
        activeLayerId: "gsi-seamlessphoto",
        reason: "ok",
        candidates: ["recent-specific", "gsi-seamlessphoto"],
        snapped: true,
      },
    },
    {
      name: "does not prefer a missing present-day photo",
      registry: [layer("recent-specific", 2025, 2025, { provider: "gsi" })],
      year: 2025,
      expected: {
        activeLayerId: "recent-specific",
        reason: "ok",
        candidates: ["recent-specific"],
        snapped: false,
      },
    },
    {
      name: "does not apply the present-day preference before its threshold",
      registry: [
        layer("recent-specific", 2020, 2020, { provider: "gsi" }),
        layer("gsi-seamlessphoto", 1900, 1900, { provider: "gsi" }),
      ],
      year: 2023,
      expected: {
        activeLayerId: "recent-specific",
        reason: "ok",
        candidates: ["recent-specific", "gsi-seamlessphoto"],
        snapped: true,
      },
    },
    {
      name: "rejects a zoom below the layer minimum",
      registry: [layer("zoomed-layer", 1930, 1930, { minzoom: 10 })],
      year: 1930,
      zoom: 9,
      expected: {
        activeLayerId: null,
        reason: "no-coverage",
        candidates: [],
        snapped: false,
      },
    },
    {
      name: "rejects a zoom above the layer maximum",
      registry: [layer("zoomed-layer", 1930, 1930, { maxzoom: 12 })],
      year: 1930,
      zoom: 13,
      expected: {
        activeLayerId: null,
        reason: "no-coverage",
        candidates: [],
        snapped: false,
      },
    },
    {
      name: "does not resolve vector-dated entries",
      registry: [layer("future-vector", 1930, 1930, { type: "vector-dated" })],
      year: 1930,
      expected: {
        activeLayerId: null,
        reason: "no-coverage",
        candidates: [],
        snapped: false,
      },
    },
    {
      name: "uses a later coverage box when the first box misses",
      registry: [
        layer("multi-coverage", 1930, 1930, {
          coverage: [[140, 40, 141, 41], TOKYO_BBOX],
        }),
      ],
      year: 1930,
      expected: {
        activeLayerId: "multi-coverage",
        reason: "ok",
        candidates: ["multi-coverage"],
        snapped: false,
      },
    },
    {
      name: "resolves the real 1928 Osaka dataset id",
      registry: loadedGsi(),
      year: 1928,
      viewBbox: OSAKA_BBOX,
      zoom: 14,
      expected: {
        activeLayerId: "gsi-ort-1928",
        reason: "ok",
        candidates: [
          "gsi-ort-1928",
          "gsi-ort-riku10",
          "gsi-ort-usa10",
          "gsi-ort-old10",
          "gsi-gazo1",
          "gsi-gazo2",
          "gsi-gazo3",
          "gsi-gazo4",
          "gsi-seamlessphoto",
        ],
        snapped: false,
      },
    },
    {
      name: "reports a filtered Konjaku registry as empty",
      registry: loadRegistry(
        [
          {
            ...layer("konjaku-filtered", 1890, 1900, {
              provider: "konjaku",
              experimental: true,
              requiresFeatureFlag: "VITE_ENABLE_KONJAKU",
            }),
            era: { from: 1890, to: null },
            tiles: {
              urlTemplate: "https://ktgis.net/kjmapw/{z}/{x}/{y}.png",
              scheme: "xyz",
              minzoom: 10,
              maxzoom: 18,
              tileSize: 256,
            },
          },
        ],
        { currentYear: CURRENT_YEAR, featureFlags: {}, warn: () => undefined },
      ),
      year: 1895,
      expected: {
        activeLayerId: null,
        reason: "registry-empty",
        candidates: [],
        snapped: false,
      },
    },
  ];

  it.each(cases)("$name", ({ registry, year, viewBbox, zoom, overrideId, expected }) => {
    const result = resolveAt(registry, year, viewBbox, zoom, overrideId);

    expect(result).toEqual(expected);
  });

  it("returns era ticks for enabled entries in deterministic order without mutation", () => {
    const registry = [
      layer("zeta", 1950, 1955),
      layer("alpha", 1950, 1951),
      layer("early", 1900, 1905, { type: "vector-dated" }),
    ];
    const before = structuredClone(registry);

    expect(eraTicks(registry)).toEqual([
      { layerId: "early", from: 1900, to: 1905 },
      { layerId: "alpha", from: 1950, to: 1951 },
      { layerId: "zeta", from: 1950, to: 1955 },
    ]);
    expect(registry).toEqual(before);
  });

  it("keeps the real rolling tick endpoint supplied by the loader", () => {
    expect(eraTicks(loadedGsi()).at(-1)).toEqual({
      layerId: "gsi-seamlessphoto",
      from: 2007,
      to: CURRENT_YEAR,
    });
  });

  it("is stable for deterministic random Japan viewports and years", () => {
    let seed = 0x18_2026;
    const random = (): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 2 ** 32;
    };
    const registry = loadedGsi();

    for (let index = 0; index < 128; index += 1) {
      const west = 122 + random() * 30;
      const south = 20 + random() * 24;
      const viewBbox: Bbox = [west, south, west + 0.1 + random() * 1.5, south + 0.1 + random() * 1];
      const input = {
        year: 1890 + Math.floor(random() * (CURRENT_YEAR - 1889)),
        viewBbox,
        zoom: 2 + Math.floor(random() * 17),
        currentYear: CURRENT_YEAR,
        registry,
      } as const;

      const first = resolve(input);
      const second = resolve(input);

      expect(second).toEqual(first);
      expect(first.activeLayerId === null || first.candidates.includes(first.activeLayerId)).toBe(
        true,
      );
    }
  });
});

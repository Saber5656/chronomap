import { describe, expect, it, vi } from "vitest";

import gsiLayers from "../../../../src/providers/layers/gsi.layers.json";
import konjakuLayers from "../../../../src/providers/layers/konjaku.layers.json";
import { loadRegistry } from "../../../../src/providers/layers/loader";
import type {
  LayerEntry,
  LayerRegistryEntry,
  RegistryWarning,
} from "../../../../src/providers/layers/types";

function validEntry(): Record<string, unknown> {
  return {
    id: "valid-layer",
    type: "raster-era",
    provider: "gsi",
    title: { ja: "有効", en: "Valid" },
    era: { from: 2020, to: null },
    region: "JP",
    coverage: [[128, 30, 146.5, 45.8]],
    tiles: {
      urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/sample/{z}/{x}/{y}.png",
      scheme: "xyz",
      minzoom: 0,
      maxzoom: 22,
      tileSize: 256,
    },
    attribution: {
      text: "Provider attribution",
      url: "https://example.com/terms",
      license: { name: "Provider terms", url: "https://example.com/license" },
    },
    flags: { experimental: false, requiresFeatureFlag: null },
    priority: 10,
  };
}

function validKonjakuEntry(): Record<string, unknown> {
  const entry = validEntry();
  entry.provider = "konjaku";
  entry.attribution = {
    text: "今昔マップ on the web",
    license: { name: "Provider terms / permission required" },
  };
  entry.tiles = {
    ...(entry.tiles as object),
    urlTemplate: "https://ktgis.net/kjmapw/kjtilemap/tokyo50/2man/{z}/{x}/{y}.png",
    scheme: "tms",
  };
  entry.flags = { experimental: true, requiresFeatureFlag: "VITE_ENABLE_KONJAKU" };
  return entry;
}

function load(values: readonly unknown[], featureFlags: Readonly<Record<string, unknown>> = {}) {
  const warnings: RegistryWarning[] = [];
  const entries = loadRegistry(values, {
    currentYear: 2026,
    featureFlags,
    warn: (warning) => warnings.push(warning),
  });
  return { entries, warnings };
}

const konjakuEraCrossCheck = [
  ["tokyo50", "2man", 1896, 1909],
  ["tokyo50", "00", 1917, 1924],
  ["tokyo50", "01", 1927, 1939],
  ["tokyo50", "02", 1944, 1954],
  ["tokyo50", "03", 1965, 1968],
  ["tokyo50", "04", 1975, 1978],
  ["tokyo50", "05", 1983, 1987],
  ["tokyo50", "06", 1992, 1995],
  ["tokyo50", "07", 1998, 2005],
  ["chukyo", "2man", 1888, 1898],
  ["chukyo", "00", 1920, 1920],
  ["chukyo", "01", 1932, 1932],
  ["chukyo", "02", 1937, 1938],
  ["chukyo", "03", 1947, 1947],
  ["chukyo", "04", 1959, 1960],
  ["chukyo", "05", 1968, 1973],
  ["chukyo", "06", 1976, 1980],
  ["chukyo", "07", 1984, 1989],
  ["chukyo", "08", 1992, 1996],
  ["keihansin", "2man", 1892, 1910],
  ["keihansin", "00", 1922, 1923],
  ["keihansin", "01", 1927, 1935],
  ["keihansin", "02", 1947, 1950],
  ["keihansin", "03", 1954, 1956],
  ["keihansin", "03x", 1961, 1964],
  ["keihansin", "04", 1967, 1970],
  ["keihansin", "05", 1975, 1979],
  ["keihansin", "06", 1983, 1988],
  ["keihansin", "07", 1993, 1997],
] as const;

describe("loadRegistry", () => {
  it("models nullable registry input separately from normalized output", () => {
    const registryEra: LayerRegistryEntry["era"] = { from: 2020, to: null };
    const loadedEra: LayerEntry["era"] = { from: 2020, to: 2026 };

    expect(registryEra.to).toBeNull();
    expect(loadedEra.to).toBe(2026);
  });

  it("normalizes rolling eras without mutating input and accepts reserved vector entries", () => {
    const raster = validEntry();
    const vector = validEntry();
    vector.id = "valid-vector";
    vector.type = "vector-dated";
    const before = structuredClone(raster);

    const { entries, warnings } = load([raster, vector]);

    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.era).toEqual({ from: 2020, to: 2026 });
    expect(raster).toEqual(before);
    expect(entries[1]?.type).toBe("vector-dated");
  });

  it("loads every S15 GSI entry without warnings or drops", () => {
    const { entries, warnings } = load(gsiLayers);

    expect(warnings).toEqual([]);
    expect(entries.map((entry) => entry.id)).toEqual([
      "gsi-ort-1928",
      "gsi-ort-riku10",
      "gsi-ort-usa10",
      "gsi-ort-old10",
      "gsi-gazo1",
      "gsi-gazo2",
      "gsi-gazo3",
      "gsi-gazo4",
      "gsi-seamlessphoto",
    ]);
    expect(entries.at(-1)?.era.to).toBe(2026);
    expect(entries.find((entry) => entry.id === "gsi-seamlessphoto")?.attribution.text).toBe(
      "全国最新写真（シームレス） / GRUS画像（© Axelspace）",
    );
  });

  it("keeps all real Konjaku eras behind the exact default-off flag and TMS contract", () => {
    expect(konjakuLayers).toHaveLength(29);
    expect(new Set(konjakuLayers.map((entry) => entry.id)).size).toBe(29);
    expect(
      konjakuLayers.map((entry) => {
        const path = new URL(entry.tiles.urlTemplate).pathname.split("/");
        return [path[3], path[4], entry.era.from, entry.era.to];
      }),
    ).toEqual(konjakuEraCrossCheck);

    for (const flagValue of [undefined, "", "false", false, true, "TRUE", "1", 1]) {
      const flags = flagValue === undefined ? {} : { VITE_ENABLE_KONJAKU: flagValue };
      const { entries, warnings } = load(konjakuLayers, flags);

      expect(warnings).toEqual([]);
      expect(entries).toEqual([]);
    }

    const enabled = load(konjakuLayers, { VITE_ENABLE_KONJAKU: "true" });
    expect(enabled.warnings).toEqual([]);
    expect(enabled.entries).toHaveLength(29);
    expect(enabled.entries.map((entry) => entry.id)).toEqual(
      konjakuLayers.map((entry) => entry.id),
    );
    for (const entry of enabled.entries) {
      expect(entry.provider).toBe("konjaku");
      expect(entry.region).toBe("JP");
      expect(entry.tiles.scheme).toBe("tms");
      expect(entry.tiles.urlTemplate).toContain("https://ktgis.net/kjmapw/kjtilemap/");
      expect(entry.tiles.urlTemplate).toContain("/{z}/{x}/{y}.png");
      expect(entry.tiles.urlTemplate).not.toContain("{-y}");
      expect(entry.attribution.text).toBe("今昔マップ on the web");
      expect(entry.attribution.license.name).toBe("Provider terms / permission required");
      expect(entry.flags).toEqual({
        experimental: true,
        requiresFeatureFlag: "VITE_ENABLE_KONJAKU",
      });
      expect(entry.priority).toBe(15);
    }
  });

  it.each([
    ["bad id", (entry: Record<string, unknown>) => (entry.id = "BAD ID"), "id"],
    [
      "inverted era",
      (entry: Record<string, unknown>) => (entry.era = { from: 2021, to: 2020 }),
      "era",
    ],
    [
      "five-value bbox",
      (entry: Record<string, unknown>) => (entry.coverage = [[0, 0, 1, 1, 2]]),
      "coverage[0]",
    ],
    [
      "out-of-range bbox",
      (entry: Record<string, unknown>) => (entry.coverage = [[-181, 0, 1, 1]]),
      "coverage[0]",
    ],
    [
      "inverted bbox",
      (entry: Record<string, unknown>) => (entry.coverage = [[1, 1, 0, 0]]),
      "coverage[0]",
    ],
    [
      "unknown host",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://evil.example/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "allowlisted-host suffix spoof",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://evil.cyberjapandata.gsi.go.jp/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "missing Japanese title",
      (entry: Record<string, unknown>) => (entry.title = { en: "Valid" }),
      "title",
    ],
    [
      "missing nested license name",
      (entry: Record<string, unknown>) => {
        entry.attribution = { text: "Provider", license: {} };
      },
      "attribution.license.name",
    ],
    [
      "bad tile scheme",
      (entry: Record<string, unknown>) => {
        entry.tiles = { ...(entry.tiles as object), scheme: "quadkey" };
      },
      "tiles.scheme",
    ],
    [
      "fractional zoom",
      (entry: Record<string, unknown>) => {
        entry.tiles = { ...(entry.tiles as object), minzoom: 1.5 };
      },
      "tiles.zoom",
    ],
    [
      "inverted zoom",
      (entry: Record<string, unknown>) => {
        entry.tiles = { ...(entry.tiles as object), minzoom: 12, maxzoom: 11 };
      },
      "tiles.zoom",
    ],
    [
      "explicit default tile port",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://cyberjapandata.gsi.go.jp:443/xyz/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "explicit alternate tile port",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://cyberjapandata.gsi.go.jp:8443/xyz/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "leading whitespace in tile URL",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: " https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "uppercase tile scheme spelling",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "HTTPS://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "extra slash tile URL spelling",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https:////cyberjapandata.gsi.go.jp:8443/xyz/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "control character in tile scheme",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "h\tttps://cyberjapandata.gsi.go.jp:8443/xyz/{z}/{x}/{y}.png",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "tile token in URL fragment",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}#{y}",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "tile token in URL query",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}?row={y}",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "bare URL fragment delimiter",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png#",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "bare URL query delimiter",
      (entry: Record<string, unknown>) => {
        entry.tiles = {
          ...(entry.tiles as object),
          urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png?",
        };
      },
      "tiles.urlTemplate",
    ],
    [
      "non-HTTPS attribution URL",
      (entry: Record<string, unknown>) => {
        entry.attribution = {
          text: "Provider",
          url: "http://example.com",
          license: { name: "Terms" },
        };
      },
      "attribution.url",
    ],
    [
      "whitespace in attribution URL",
      (entry: Record<string, unknown>) => {
        entry.attribution = {
          text: "Provider",
          url: "https://example.com/terms ",
          license: { name: "Terms" },
        };
      },
      "attribution.url",
    ],
    [
      "Unicode whitespace in attribution URL",
      (entry: Record<string, unknown>) => {
        entry.attribution = {
          text: "Provider",
          url: "https://example.com/a\u00a0b",
          license: { name: "Terms" },
        };
      },
      "attribution.url",
    ],
    [
      "uppercase license URL scheme",
      (entry: Record<string, unknown>) => {
        entry.attribution = {
          text: "Provider",
          license: { name: "Terms", url: "HTTPS://example.com/license" },
        };
      },
      "attribution.license.url",
    ],
  ])("drops %s with bounded diagnostic context", (_name, mutate, field) => {
    const entry = validEntry();
    mutate(entry);

    const { entries, warnings } = load([entry]);

    expect(entries).toEqual([]);
    expect(warnings).toEqual([expect.objectContaining({ index: 0, field })]);
    expect(JSON.stringify(warnings)).not.toContain("Provider attribution");
  });

  it("keeps the first valid duplicate and warns for later entries", () => {
    const first = validEntry();
    const second = validEntry();
    (second.title as Record<string, unknown>).en = "Second";

    const { entries, warnings } = load([first, second]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.title.en).toBe("Valid");
    expect(warnings).toEqual([{ index: 1, field: "id", reason: "duplicate id valid-layer" }]);
  });

  it.each([
    [undefined, false],
    ["false", false],
    [true, false],
    ["true", true],
  ])("enables a feature-gated entry only for exact string true (%j)", (flagValue, included) => {
    const entry = validEntry();
    entry.flags = { experimental: true, requiresFeatureFlag: "VITE_ENABLE_TEST" };
    const flags = flagValue === undefined ? {} : { VITE_ENABLE_TEST: flagValue };

    expect(load([entry], flags).entries).toHaveLength(included ? 1 : 0);
  });

  it("validates disabled entries before feature-flag filtering", () => {
    const entry = validEntry();
    entry.flags = { experimental: true, requiresFeatureFlag: "VITE_DISABLED" };
    entry.tiles = {
      ...(entry.tiles as object),
      urlTemplate: "https://evil.example/{z}/{x}/{y}.png",
    };

    const { entries, warnings } = load([entry], { VITE_DISABLED: "false" });

    expect(entries).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.field).toBe("tiles.urlTemplate");
    expect(warnings[0]?.reason).toContain("evil.example");
  });

  it("requires the Konjaku feature flag for every ktgis.net entry", () => {
    const entry = validKonjakuEntry();

    const ungated = load([entry]);
    const gatedOff = load([entry]);
    const gatedOn = load([entry], { VITE_ENABLE_KONJAKU: "true" });
    entry.flags = { experimental: true, requiresFeatureFlag: "VITE_ENABLE_OTHER" };
    const wronglyGated = load([entry], { VITE_ENABLE_OTHER: "true" });

    expect(ungated.entries).toEqual([]);
    expect(ungated.warnings).toEqual([]);
    expect(gatedOff).toEqual({ entries: [], warnings: [] });
    expect(gatedOn.entries).toHaveLength(1);
    expect(wronglyGated.entries).toEqual([]);
    expect(wronglyGated.warnings[0]?.field).toBe("flags.requiresFeatureFlag");
  });

  it.each([
    ["provider", (entry: Record<string, unknown>) => (entry.provider = "gsi"), "provider"],
    [
      "experimental flag",
      (entry: Record<string, unknown>) => {
        entry.flags = { experimental: false, requiresFeatureFlag: "VITE_ENABLE_KONJAKU" };
      },
      "flags.experimental",
    ],
    [
      "attribution",
      (entry: Record<string, unknown>) => {
        entry.attribution = {
          text: "wrong credit",
          license: { name: "Provider terms / permission required" },
        };
      },
      "attribution.text",
    ],
    [
      "license label",
      (entry: Record<string, unknown>) => {
        entry.attribution = {
          text: "今昔マップ on the web",
          license: { name: "CC BY" },
        };
      },
      "attribution.license.name",
    ],
  ])("rejects a ktgis.net entry with an invalid Konjaku %s", (_name, mutate, field) => {
    const entry = validKonjakuEntry();
    mutate(entry);

    const { entries, warnings } = load([entry], { VITE_ENABLE_KONJAKU: "true" });

    expect(entries).toEqual([]);
    expect(warnings).toEqual([expect.objectContaining({ index: 0, field })]);
  });

  it("requires TMS for ktgis.net entries so MapLibre owns the y flip", () => {
    const entry = validKonjakuEntry();
    entry.tiles = {
      ...(entry.tiles as object),
      scheme: "xyz",
    };

    const { entries, warnings } = load([entry], { VITE_ENABLE_KONJAKU: "true" });

    expect(entries).toEqual([]);
    expect(warnings).toEqual([
      {
        index: 0,
        field: "tiles.scheme",
        reason: "ktgis.net tiles must use the tms scheme",
      },
    ]);
  });

  it("bounds an unknown-host diagnostic", () => {
    const entry = validEntry();
    const hostileHost = `${"a".repeat(200)}.example`;
    entry.tiles = {
      ...(entry.tiles as object),
      urlTemplate: `https://${hostileHost}/{z}/{x}/{y}.png`,
    };

    const { warnings } = load([entry]);

    expect(warnings[0]?.reason.length).toBeLessThanOrEqual(150);
    expect(warnings[0]?.reason).toContain("...");
  });

  it("deep-strips unknown fields while preserving known values", () => {
    const entry = validEntry();
    entry.unknown = "drop";
    (entry.title as Record<string, unknown>).unknown = "drop";
    ((entry.attribution as Record<string, unknown>).license as Record<string, unknown>).unknown =
      "drop";

    const loaded = load([entry]).entries[0];

    expect(loaded).toEqual(expect.objectContaining({ id: "valid-layer" }));
    expect(loaded).not.toHaveProperty("unknown");
    expect(loaded?.title).not.toHaveProperty("unknown");
    expect(loaded?.attribution.license).not.toHaveProperty("unknown");
  });

  it("fails closed when currentYear is not an integer", () => {
    const warn = vi.fn();

    expect(loadRegistry([validEntry()], { currentYear: 2026.5, featureFlags: {}, warn })).toEqual(
      [],
    );
    expect(warn).toHaveBeenCalledWith({
      index: -1,
      field: "env.currentYear",
      reason: "must be an integer",
    });
  });
});

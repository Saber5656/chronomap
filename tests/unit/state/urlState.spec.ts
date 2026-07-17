import { describe, expect, it } from "vitest";

import { label, latLng, opacity, year, zoom } from "../../../src/security/validate";
import {
  parseUrlState,
  serializeUrlState,
  type SerializableUrlState,
  type UrlStatePatch,
} from "../../../src/state/urlState";

const NOW = new Date(2026, 0, 1);
const REGISTRY_IDS = new Set(["gsi-1960", "gsi-current"]);
const DEFAULT_VIEW = { lat: 36.5, lng: 138.5, zoom: 5 };

function state(overrides: Partial<SerializableUrlState> = {}): SerializableUrlState {
  return {
    view: DEFAULT_VIEW,
    year: 2026,
    requestedLayerId: null,
    timeLayer: { opacity: 1 },
    poi: { enabled: true },
    ...overrides,
  };
}

interface ParameterCase {
  name: string;
  search: string;
  expected: UrlStatePatch;
}

const longLabel = "a".repeat(121);
const parameterCases: ParameterCase[] = [
  { name: "lat missing", search: "", expected: {} },
  {
    name: "lat valid",
    search: "?lat=35.1234567",
    expected: { view: { lat: 35.123457, lng: 138.5, zoom: 5 } },
  },
  {
    name: "lat out-of-range",
    search: "?lat=100",
    expected: { view: { lat: 90, lng: 138.5, zoom: 5 } },
  },
  {
    name: "lat garbage",
    search: "?lat=0x10",
    expected: { view: DEFAULT_VIEW },
  },
  {
    name: "lat duplicate",
    search: "?lat=35&lat=36",
    expected: { view: { lat: 35, lng: 138.5, zoom: 5 } },
  },
  { name: "lng missing", search: "?unknown=x", expected: {} },
  {
    name: "lng valid",
    search: "?lng=139.7654321",
    expected: { view: { lat: 36.5, lng: 139.765432, zoom: 5 } },
  },
  {
    name: "lng out-of-range",
    search: "?lng=-200",
    expected: { view: { lat: 36.5, lng: -180, zoom: 5 } },
  },
  {
    name: "lng garbage",
    search: "?lng=--5",
    expected: { view: DEFAULT_VIEW },
  },
  {
    name: "lng duplicate",
    search: "?lng=139&lng=140",
    expected: { view: { lat: 36.5, lng: 139, zoom: 5 } },
  },
  { name: "z missing", search: "?x=1", expected: {} },
  {
    name: "z valid",
    search: "?z=16.126",
    expected: { view: { lat: 36.5, lng: 138.5, zoom: 16.13 } },
  },
  {
    name: "z out-of-range",
    search: "?z=99",
    expected: { view: { lat: 36.5, lng: 138.5, zoom: 18 } },
  },
  {
    name: "z garbage",
    search: "?z=NaN",
    expected: { view: DEFAULT_VIEW },
  },
  {
    name: "z duplicate",
    search: "?z=12&z=15",
    expected: { view: { lat: 36.5, lng: 138.5, zoom: 12 } },
  },
  { name: "year missing", search: "?other=2020", expected: {} },
  { name: "year valid", search: "?year=1965", expected: { year: 1965 } },
  { name: "year out-of-range", search: "?year=1800", expected: { year: 1890 } },
  { name: "year garbage", search: "?year=1965.5", expected: { year: 2026 } },
  { name: "year duplicate", search: "?year=1965&year=1970", expected: { year: 1965 } },
  { name: "l missing", search: "?other=gsi-1960", expected: {} },
  {
    name: "l valid",
    search: "?l=gsi-1960",
    expected: { requestedLayerId: "gsi-1960" },
  },
  {
    name: "l out-of-range",
    search: `?l=${"a".repeat(65)}`,
    expected: { requestedLayerId: null },
  },
  {
    name: "l garbage",
    search: "?l=GSI_1960",
    expected: { requestedLayerId: null },
  },
  {
    name: "l duplicate",
    search: "?l=gsi-current&l=gsi-1960",
    expected: { requestedLayerId: "gsi-current" },
  },
  { name: "op missing", search: "?other=60", expected: {} },
  { name: "op valid", search: "?op=60", expected: { timeLayer: { opacity: 0.6 } } },
  { name: "op out-of-range", search: "?op=-1", expected: { timeLayer: { opacity: 0 } } },
  { name: "op garbage", search: "?op=60.5", expected: { timeLayer: { opacity: 1 } } },
  { name: "op duplicate", search: "?op=25&op=75", expected: { timeLayer: { opacity: 0.25 } } },
  { name: "poi missing", search: "?other=0", expected: {} },
  { name: "poi valid", search: "?poi=0", expected: { poi: { enabled: false } } },
  { name: "poi out-of-range", search: "?poi=2", expected: { poi: { enabled: true } } },
  { name: "poi garbage", search: "?poi=yes", expected: { poi: { enabled: true } } },
  { name: "poi duplicate", search: "?poi=0&poi=1", expected: { poi: { enabled: false } } },
  { name: "label missing", search: "?other=label", expected: {} },
  { name: "label valid", search: "?label=Tokyo", expected: { label: "Tokyo" } },
  {
    name: "label out-of-range",
    search: `?label=${longLabel}`,
    expected: { label: "a".repeat(120) },
  },
  { name: "label garbage", search: "?label=%00%E2%80%AE", expected: { label: null } },
  {
    name: "label duplicate",
    search: "?label=first&label=second",
    expected: { label: "first" },
  },
];

describe("parseUrlState parameter contract", () => {
  it.each(parameterCases)("handles $name", ({ search, expected }) => {
    expect(parseUrlState(search, NOW, REGISTRY_IDS)).toEqual(expected);
  });

  it("parses all parameters independently and ignores unknown values", () => {
    expect(
      parseUrlState(
        "?unknown=x&lat=34.7025&lng=135.4959&z=16&year=1965&l=gsi-1960&op=60&poi=0&label=%E6%A2%85%E7%94%B0",
        NOW,
        REGISTRY_IDS,
      ),
    ).toEqual({
      view: { lat: 34.7025, lng: 135.4959, zoom: 16 },
      year: 1965,
      requestedLayerId: "gsi-1960",
      timeLayer: { opacity: 0.6 },
      poi: { enabled: false },
      label: "梅田",
    });
  });

  it("accepts finite decimal exponent syntax but rejects overflow exponent syntax", () => {
    expect(parseUrlState("?lat=3.5e1", NOW, REGISTRY_IDS).view?.lat).toBe(35);
    expect(parseUrlState("?lat=1e309", NOW, REGISTRY_IDS).view).toEqual(DEFAULT_VIEW);
  });

  it("accepts exactly 2048 search characters and rejects 2049", () => {
    const atLimitPrefix = "?poi=0&padding=";
    const atLimit = `${atLimitPrefix}${"a".repeat(2_048 - atLimitPrefix.length)}`;
    const aboveLimit = `${atLimit}a`;

    expect(atLimit).toHaveLength(2_048);
    expect(parseUrlState(atLimit, NOW, REGISTRY_IDS)).toEqual({ poi: { enabled: false } });
    expect(aboveLimit).toHaveLength(2_049);
    expect(parseUrlState(aboveLimit, NOW, REGISTRY_IDS)).toEqual({});
  });

  it("accepts both public POI flag literals", () => {
    expect(parseUrlState("?poi=0", NOW, REGISTRY_IDS).poi).toEqual({ enabled: false });
    expect(parseUrlState("?poi=1", NOW, REGISTRY_IDS).poi).toEqual({ enabled: true });
  });

  it("strips controls while preserving label markup as plain text", () => {
    expect(parseUrlState("?label=%E2%80%AEabc%3Cscript%3E", NOW, REGISTRY_IDS).label).toBe(
      "abc<script>",
    );
  });
});

describe("serializeUrlState", () => {
  it("omits the complete default state", () => {
    expect(serializeUrlState(state(), REGISTRY_IDS, NOW)).toBe("");
  });

  it("uses the stable public parameter order and rounds numeric values", () => {
    expect(
      serializeUrlState(
        state({
          view: { lat: 35.1234567, lng: 139.7654321, zoom: 14.126 },
          year: 1965,
          requestedLayerId: "gsi-1960",
          timeLayer: { opacity: 0.604 },
          poi: { enabled: false },
          label: "  東京駅  ",
        }),
        REGISTRY_IDS,
        NOW,
      ),
    ).toBe(
      "?lat=35.123457&lng=139.765432&z=14.13&year=1965&l=gsi-1960&op=60&poi=0&label=%E6%9D%B1%E4%BA%AC%E9%A7%85",
    );
  });

  it("omits an invalid or unknown layer id", () => {
    expect(serializeUrlState(state({ requestedLayerId: "unknown-layer" }), REGISTRY_IDS, NOW)).toBe(
      "",
    );
    expect(serializeUrlState(state({ requestedLayerId: "GSI_1960" }), REGISTRY_IDS, NOW)).toBe("");
  });

  it("omits invalid trusted numeric state instead of throwing", () => {
    expect(
      serializeUrlState(
        state({
          view: { lat: Number.NaN, lng: 138.5, zoom: Number.NaN },
          year: Number.NaN,
          timeLayer: { opacity: Number.NaN },
        }),
        REGISTRY_IDS,
        NOW,
      ),
    ).toBe("");
  });

  it("clamps serializable numeric state to the contract", () => {
    expect(
      serializeUrlState(
        state({
          view: { lat: 100, lng: -200, zoom: 99 },
          year: 1800,
          timeLayer: { opacity: -1 },
        }),
        REGISTRY_IDS,
        NOW,
      ),
    ).toBe("?lat=90&lng=-180&z=18&year=1890&op=0");
  });

  it("round-trips effective non-default values", () => {
    const serialized = serializeUrlState(
      state({
        view: { lat: 34.7025001, lng: 135.4958999, zoom: 16.004 },
        year: 1965,
        requestedLayerId: "gsi-current",
        timeLayer: { opacity: 0.25 },
        poi: { enabled: false },
        label: "大阪",
      }),
      REGISTRY_IDS,
      NOW,
    );
    expect(parseUrlState(serialized, NOW, REGISTRY_IDS)).toEqual({
      view: { lat: 34.7025, lng: 135.4959, zoom: 16 },
      year: 1965,
      requestedLayerId: "gsi-current",
      timeLayer: { opacity: 0.25 },
      poi: { enabled: false },
      label: "大阪",
    });
  });

  it("keeps serialized state canonical across a cross-product of effective values", () => {
    const views = [
      DEFAULT_VIEW,
      { lat: 34.7025001, lng: 135.4958999, zoom: 16.004 },
      { lat: 100, lng: -200, zoom: 99 },
    ];
    const years = [2026, 1965, 1800];
    const layerIds = [null, "gsi-current", "unknown-layer"];
    const opacities = [1, 0.604, -1];
    const poiValues = [true, false];
    const labels = [null, "  大阪  ", "\u202eabc<script>"];
    let checked = 0;

    for (const view of views) {
      for (const selectedYear of years) {
        for (const requestedLayerId of layerIds) {
          for (const selectedOpacity of opacities) {
            for (const enabled of poiValues) {
              for (const selectedLabel of labels) {
                const serialized = serializeUrlState(
                  state({
                    view,
                    year: selectedYear,
                    requestedLayerId,
                    timeLayer: { opacity: selectedOpacity },
                    poi: { enabled },
                    label: selectedLabel,
                  }),
                  REGISTRY_IDS,
                  NOW,
                );
                const parsed = parseUrlState(serialized, NOW, REGISTRY_IDS);
                const effective = state({
                  view: parsed.view ?? DEFAULT_VIEW,
                  year: parsed.year ?? NOW.getFullYear(),
                  requestedLayerId: parsed.requestedLayerId ?? null,
                  timeLayer: parsed.timeLayer ?? { opacity: 1 },
                  poi: parsed.poi ?? { enabled: true },
                  label: parsed.label ?? null,
                });

                expect(serializeUrlState(effective, REGISTRY_IDS, NOW)).toBe(serialized);
                checked += 1;
              }
            }
          }
        }
      }
    }

    expect(checked).toBe(486);
  });
});

describe("seeded hostile-input fuzzing", () => {
  it("never throws and preserves every output invariant across 500 cases", () => {
    let seed = 0x5eed1234;
    const random = (): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const hostile = [
      "1e309",
      "NaN",
      "<script>",
      "%00",
      "%E2%80%AEabc",
      "--5",
      "0x10",
      "a".repeat(10_000),
      "35.681236",
      "139.767125",
      "0",
      "1",
      "gsi-1960",
    ];
    const keys = ["lat", "lng", "z", "year", "l", "op", "poi", "label"];

    for (let index = 0; index < 500; index += 1) {
      const parts: string[] = [];
      for (const key of keys) {
        if (random() < 0.65) {
          const value = hostile[Math.floor(random() * hostile.length)]!;
          parts.push(`${key}=${value}`);
          if (random() < 0.2) parts.push(`${key}=duplicate`);
        }
      }
      const search = `?${parts.join("&")}`;
      const parse = (): UrlStatePatch => parseUrlState(search, NOW, REGISTRY_IDS);

      expect(parse).not.toThrow();
      const parsed = parse();
      if (parsed.view !== undefined) {
        expect(latLng(parsed.view.lat, parsed.view.lng)).toEqual({
          lat: parsed.view.lat,
          lng: parsed.view.lng,
        });
        expect(zoom(parsed.view.zoom)).toBe(parsed.view.zoom);
      }
      if (parsed.year !== undefined) expect(year(parsed.year, NOW)).toBe(parsed.year);
      if (parsed.timeLayer !== undefined) {
        expect(opacity(Math.round(parsed.timeLayer.opacity * 100))).toBe(parsed.timeLayer.opacity);
      }
      if (parsed.requestedLayerId !== undefined && parsed.requestedLayerId !== null) {
        expect(REGISTRY_IDS.has(parsed.requestedLayerId)).toBe(true);
      }
      if (parsed.label !== undefined && parsed.label !== null) {
        expect(label(parsed.label)).toBe(parsed.label);
        expect([...parsed.label].length).toBeLessThanOrEqual(120);
      }
    }
  });
});

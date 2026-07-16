import { describe, expect, it } from "vitest";

import {
  POI_MAX,
  POI_MIN_ZOOM,
  YEAR_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  createInitialState,
} from "../../../src/state/appState";

describe("createInitialState", () => {
  it("matches the DESIGN §5.1 defaults", () => {
    expect(createInitialState(new Date(2026, 6, 16))).toEqual({
      view: { lat: 36.5, lng: 138.5, zoom: 5 },
      year: 2026,
      requestedLayerId: null,
      timeLayer: {
        activeLayerId: null,
        opacity: 1,
        resolution: { candidates: [], reason: "registry-empty" },
      },
      poi: {
        enabled: true,
        status: "idle",
        items: [],
        selectedId: null,
      },
      geo: { status: "idle", fix: null },
      ui: { sheet: "none", toast: null, lang: "ja" },
    });
  });

  it("exports the canonical state bounds", () => {
    expect({ YEAR_MIN, POI_MIN_ZOOM, POI_MAX, ZOOM_MIN, ZOOM_MAX }).toEqual({
      YEAR_MIN: 1890,
      POI_MIN_ZOOM: 13,
      POI_MAX: 50,
      ZOOM_MIN: 2,
      ZOOM_MAX: 18,
    });
  });
});

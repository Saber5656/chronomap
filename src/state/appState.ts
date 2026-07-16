export const YEAR_MIN = 1890;
export const POI_MIN_ZOOM = 13;
export const POI_MAX = 50;
export const ZOOM_MIN = 2;
export const ZOOM_MAX = 18;

/** Temporary shared shape; Issue 23 moves the provider-facing model to providers/poi/types.ts. */
export interface Poi {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceM?: number;
  source: {
    provider: "wikipedia" | "commons";
    lang: string;
    url: string;
  };
}

export interface AppState {
  view: { lat: number; lng: number; zoom: number };
  year: number;
  requestedLayerId: string | null;
  timeLayer: {
    activeLayerId: string | null;
    opacity: number;
    resolution: {
      candidates: string[];
      reason: "ok" | "no-coverage" | "registry-empty";
    };
  };
  poi: {
    enabled: boolean;
    status: "idle" | "loading" | "ready" | "error" | "below-zoom";
    items: Poi[];
    selectedId: string | null;
  };
  geo: {
    status: "idle" | "requesting" | "granted" | "denied" | "unavailable";
    fix: { lat: number; lng: number; accuracyM: number; at: number } | null;
  };
  ui: {
    sheet: "none" | "poi" | "layers" | "about" | "import";
    toast: { id: number; kind: "info" | "error"; text: string } | null;
    lang: "ja" | "en";
  };
}

export function createInitialState(now: Date): AppState {
  return {
    view: { lat: 36.5, lng: 138.5, zoom: 5 },
    year: now.getFullYear(),
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
    geo: {
      status: "idle",
      fix: null,
    },
    ui: {
      sheet: "none",
      toast: null,
      lang: "ja",
    },
  };
}

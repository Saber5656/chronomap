import type { Poi } from "../providers/poi/types";

export const YEAR_MIN = 1890;
export const POI_MIN_ZOOM = 13;
export const POI_MAX = 50;
export const ZOOM_MIN = 2;
export const ZOOM_MAX = 18;

export type ImportFailureReason = "shortlink" | "no-coords" | "invalid";

export interface ImportSheetRequest {
  prefill: string;
  reason: ImportFailureReason | null;
  autofocus: boolean;
}

export type { Poi } from "../providers/poi/types";

export interface AppState {
  view: { lat: number; lng: number; zoom: number };
  year: number;
  requestedLayerId: string | null;
  timeLayer: {
    activeLayerId: string | null;
    opacity: number;
    disabled: boolean;
    resolution: {
      candidates: string[];
      reason: "ok" | "no-coverage" | "registry-empty";
      snapped: boolean;
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
    importRequest: ImportSheetRequest | null;
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
      disabled: true,
      resolution: { candidates: [], reason: "registry-empty", snapped: false },
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
      importRequest: null,
      toast: null,
      lang: "ja",
    },
  };
}

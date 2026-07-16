import { latLng, opacity, year, zoom } from "../security/validate";
import type { AppState, Poi } from "./appState";
import { POI_MAX } from "./appState";
import type { Store } from "./store";

export interface AppActions {
  setView(view: AppState["view"]): void;
  setYear(value: number, now?: Date): void;
  setOpacity(percent: number): void;
  setActiveLayer(
    activeLayerId: string | null,
    resolution?: AppState["timeLayer"]["resolution"],
  ): void;
  setPoiStatus(status: AppState["poi"]["status"]): void;
  setPoiItems(items: readonly Poi[]): void;
  selectPoi(id: string | null): void;
  setGeoStatus(status: AppState["geo"]["status"]): void;
  setFix(fix: NonNullable<AppState["geo"]["fix"]> | null): void;
  openSheet(sheet: Exclude<AppState["ui"]["sheet"], "none">): void;
  closeSheet(): void;
  showToast(kind: "info" | "error", text: string): void;
  setLang(lang: AppState["ui"]["lang"]): void;
}

export function createActions(store: Store<AppState>): AppActions {
  return {
    setView(view) {
      const coordinates = latLng(view.lat, view.lng);
      const validatedZoom = zoom(view.zoom);
      if (coordinates === null || validatedZoom === null) return;
      store.set({ view: { ...coordinates, zoom: validatedZoom } });
    },
    setYear(value, now = new Date()) {
      const validated = year(value, now);
      if (validated !== null) store.set({ year: validated });
    },
    setOpacity(percent) {
      const validated = opacity(percent);
      if (validated === null) return;
      store.set((state) => ({
        ...state,
        timeLayer: { ...state.timeLayer, opacity: validated },
      }));
    },
    setActiveLayer(activeLayerId, resolution) {
      store.set((state) => ({
        ...state,
        timeLayer: {
          ...state.timeLayer,
          activeLayerId,
          resolution: resolution ?? state.timeLayer.resolution,
        },
      }));
    },
    setPoiStatus(status) {
      store.set((state) => ({ ...state, poi: { ...state.poi, status } }));
    },
    setPoiItems(items) {
      const limited = items.slice(0, POI_MAX);
      store.set((state) => ({
        ...state,
        poi: {
          ...state.poi,
          items: limited,
          selectedId: limited.some((item) => item.id === state.poi.selectedId)
            ? state.poi.selectedId
            : null,
        },
      }));
    },
    selectPoi(selectedId) {
      store.set((state) => ({
        ...state,
        poi: {
          ...state.poi,
          selectedId:
            selectedId === null || state.poi.items.some((item) => item.id === selectedId)
              ? selectedId
              : null,
        },
      }));
    },
    setGeoStatus(status) {
      store.set((state) => ({ ...state, geo: { ...state.geo, status } }));
    },
    setFix(fix) {
      if (fix === null) {
        store.set((state) => ({ ...state, geo: { ...state.geo, fix: null } }));
        return;
      }
      const coordinates = latLng(fix.lat, fix.lng);
      if (
        coordinates === null ||
        !Number.isFinite(fix.accuracyM) ||
        fix.accuracyM < 0 ||
        !Number.isFinite(fix.at)
      ) {
        return;
      }
      store.set((state) => ({
        ...state,
        geo: { ...state.geo, fix: { ...coordinates, accuracyM: fix.accuracyM, at: fix.at } },
      }));
    },
    openSheet(sheet) {
      store.set((state) => ({ ...state, ui: { ...state.ui, sheet } }));
    },
    closeSheet() {
      store.set((state) => ({ ...state, ui: { ...state.ui, sheet: "none" } }));
    },
    showToast(kind, text) {
      store.set((state) => ({
        ...state,
        ui: {
          ...state.ui,
          toast: { id: (state.ui.toast?.id ?? 0) + 1, kind, text },
        },
      }));
    },
    setLang(lang) {
      store.set((state) => ({ ...state, ui: { ...state.ui, lang } }));
    },
  };
}

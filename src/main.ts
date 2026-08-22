import { bootstrap } from "./app/bootstrap";
import { registerServiceWorker } from "./app/swUpdate";
import {
  USER_LOCATION_ACCURACY_LAYER_ID,
  USER_LOCATION_DOT_LAYER_ID,
  USER_LOCATION_SOURCE_ID,
  type MapLngLat,
} from "./map";
import { loadRegistry } from "./providers/layers";
import { createActions } from "./state/actions";
import { YEAR_MIN, type AppState } from "./state/appState";
import { initUrlSync } from "./state/urlSync";
import gsiLayers from "./providers/layers/gsi.layers.json";
import type { LayerEntry } from "./providers/layers/types";
import { mountLocateButton, mountMenuButton, mountTimeSlider, mountToast } from "./ui/components";
import "./ui/styles/base.css";
import "./app/pointPicker.css";
import "./ui/components/MapHandoffMenu.css";
import "./ui/components/MenuButton.css";
import "./ui/components/Toast.css";
import "./ui/components/TimeSlider.css";

interface ChronomapDebugHook {
  getState(): Readonly<AppState>;
  getMapView(): { lat: number; lng: number; zoom: number };
  setView(view: AppState["view"]): void;
  getLastLongPress(): MapLngLat | null;
  getPickedPoint(): { lat: number; lng: number } | null;
  isMapLoaded(): boolean;
  hasUserLocationLayers(): boolean;
  setOpacity(percent: number): void;
  getStyle(): unknown;
  setOverlayLayer(entry: LayerEntry | null): void;
}

declare global {
  interface Window {
    __chronomapDebug?: ChronomapDebugHook;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Missing #app root element.");
}

const now = new Date();
const currentYear = Math.max(
  YEAR_MIN,
  Number.isFinite(now.getFullYear()) ? now.getFullYear() : YEAR_MIN,
);
const layerRegistry: LayerEntry[] = loadRegistry(gsiLayers, {
  currentYear,
  featureFlags: { VITE_ENABLE_KONJAKU: import.meta.env.VITE_ENABLE_KONJAKU },
});
const registryIds = new Set(layerRegistry.map((entry) => entry.id));
let urlSync: ReturnType<typeof initUrlSync> | undefined;
const runtime = bootstrap(app, now, {
  layerRegistry,
  currentYear,
  beforeShell: (store) => {
    urlSync = initUrlSync(store, registryIds, { now });
  },
  mountMenuButton: (parent, store) =>
    mountMenuButton(parent, store, {
      registryIds,
      getSerialized: () => urlSync?.getSerialized() ?? "",
    }),
  mountToast,
  mountTimeSlider: (parent, store) =>
    mountTimeSlider(parent, store, { registry: layerRegistry, currentYear, now }),
  afterMap: ({ mapController }) => {
    urlSync?.connectIdle((callback) => {
      const map = mapController.getMap();
      const unsubscribe = mapController.onIdle(callback);
      const markReady = (): void => callback();
      map.once("load", markReady);
      // A stubbed/offline tile source can keep MapLibre.loaded() false after the style is ready;
      // the load event or style readiness is the safe bootstrap boundary for URL writes.
      if (map.loaded() || map.isStyleLoaded()) markReady();
      return () => {
        unsubscribe();
        map.off("load", markReady);
      };
    });
  },
  mountLocateButton: (parent, store, mapController) =>
    mountLocateButton(parent, store, { mapController }),
});
const { store, mapController, overlayManager, pointPicker } = runtime;

if (import.meta.env.PROD) {
  void registerServiceWorker(runtime.shell.getSlot("toast-host"));
}

const isDebugContext = import.meta.env.DEV || import.meta.env.VITE_E2E === "true";

if (isDebugContext) {
  const actions = createActions(store);
  let lastLongPress: MapLngLat | null = null;
  mapController.onLongPress((lngLat) => {
    lastLongPress = lngLat;
  });

  window.__chronomapDebug = {
    getState: () => store.get(),
    getMapView: () => {
      const map = mapController.getMap();
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
    },
    setView: (view) => actions.setView(view),
    getLastLongPress: () => lastLongPress,
    getPickedPoint: () => pointPicker.getPickedPoint(),
    isMapLoaded: () => mapController.getMap().loaded(),
    hasUserLocationLayers: () => {
      const map = mapController.getMap();
      return (
        map.getSource(USER_LOCATION_SOURCE_ID) !== undefined &&
        map.getLayer(USER_LOCATION_ACCURACY_LAYER_ID) !== undefined &&
        map.getLayer(USER_LOCATION_DOT_LAYER_ID) !== undefined
      );
    },
    setOpacity: (percent) => actions.setOpacity(percent),
    getStyle: () => mapController.getMap().getStyle(),
    setOverlayLayer: (entry) => overlayManager?.setLayer(entry, store.get().timeLayer.opacity),
  };
}

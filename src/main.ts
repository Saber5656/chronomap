import { bootstrap } from "./app/bootstrap";
import {
  USER_LOCATION_ACCURACY_LAYER_ID,
  USER_LOCATION_DOT_LAYER_ID,
  USER_LOCATION_SOURCE_ID,
  type MapLngLat,
} from "./map/mapController";
import { createActions } from "./state/actions";
import type { AppState } from "./state/appState";
import { initUrlSync } from "./state/urlSync";
import gsiLayers from "./providers/layers/gsi.layers.json";
import { mountLocateButton, mountMenuButton, mountToast } from "./ui/components";
import "./ui/styles/base.css";
import "./ui/components/MapHandoffMenu.css";
import "./ui/components/MenuButton.css";
import "./ui/components/Toast.css";

interface ChronomapDebugHook {
  getState(): Readonly<AppState>;
  getMapView(): { lat: number; lng: number; zoom: number };
  setView(view: AppState["view"]): void;
  getLastLongPress(): MapLngLat | null;
  isMapLoaded(): boolean;
  hasUserLocationLayers(): boolean;
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
const registryIds = new Set(gsiLayers.map((entry) => entry.id));
let urlSync: ReturnType<typeof initUrlSync> | undefined;
const runtime = bootstrap(app, now, {
  beforeShell: (store) => {
    urlSync = initUrlSync(store, registryIds, { now });
  },
  mountMenuButton: (parent, store) =>
    mountMenuButton(parent, store, {
      registryIds,
      getSerialized: () => urlSync?.getSerialized() ?? "",
    }),
  mountToast,
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
const { store, mapController } = runtime;

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
    isMapLoaded: () => mapController.getMap().loaded(),
    hasUserLocationLayers: () => {
      const map = mapController.getMap();
      return (
        map.getSource(USER_LOCATION_SOURCE_ID) !== undefined &&
        map.getLayer(USER_LOCATION_ACCURACY_LAYER_ID) !== undefined &&
        map.getLayer(USER_LOCATION_DOT_LAYER_ID) !== undefined
      );
    },
  };
}

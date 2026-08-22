import { mount } from "./app/appShell";
import { createMap, type MapLngLat } from "./map/mapController";
import { createActions } from "./state/actions";
import { createInitialState, type AppState } from "./state/appState";
import { createStore } from "./state/store";
import "./ui/styles/base.css";

interface ChronomapDebugHook {
  getState(): Readonly<AppState>;
  getMapView(): { lat: number; lng: number; zoom: number };
  setView(view: AppState["view"]): void;
  getLastLongPress(): MapLngLat | null;
  isMapLoaded(): boolean;
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

const store = createStore(createInitialState(new Date()));
const shell = mount(app, store);
const mapController = createMap(shell.getSlot("map"), store);

const isDebugContext =
  import.meta.env.DEV ||
  (!import.meta.env.PROD &&
    (import.meta.env.MODE === "e2e" || import.meta.env.VITE_E2E === "true"));

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
  };
}

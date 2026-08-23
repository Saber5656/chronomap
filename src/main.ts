import { bootstrap } from "./app/bootstrap";
import { registerServiceWorker } from "./app/swUpdate";
import {
  USER_LOCATION_ACCURACY_LAYER_ID,
  USER_LOCATION_DOT_LAYER_ID,
  USER_LOCATION_SOURCE_ID,
  GSI_ATTRIBUTION_TEXT,
  GSI_ATTRIBUTION_URL,
  GSI_BASEMAP_SOURCE_ID,
  type MapLngLat,
} from "./map";
import { loadRegistry } from "./providers/layers";
import { KONJAKU_FEATURE_FLAG } from "./security/hosts";
import { createActions } from "./state/actions";
import { YEAR_MIN, type AppState } from "./state/appState";
import { initUrlSync } from "./state/urlSync";
import { handleShareRoute, type ShareFallback } from "./integrations/shareRoute";
import gsiLayers from "./providers/layers/gsi.layers.json";
import type { LayerEntry } from "./providers/layers/types";
import {
  mountLocateButton,
  mountMenuButton,
  mountOpacityControl,
  mountPoiToggle,
  mountTimeSlider,
  mountToast,
} from "./ui/components";
import type { BasemapInfo, PoiSourceInfo } from "./ui/components/LayersSheet";
import "./ui/styles/base.css";
import "./app/pointPicker.css";
import "./ui/components/MapHandoffMenu.css";
import "./ui/components/MenuButton.css";
import "./ui/components/Toast.css";
import "./ui/components/CoverageBanner.css";
import "./ui/components/TimeSlider.css";
import "./ui/components/OpacityControl.css";
import "./ui/components/PoiToggle.css";
import "./ui/components/BottomSheet.css";
import "./ui/components/ImportSheet.css";
import "./ui/components/LayerInfoBadge.css";
import "./ui/components/LayersSheet.css";
import "./ui/components/PoiSheet.css";

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
  getPoiScreenPoint(id: string): { x: number; y: number } | null;
}

const ONBOARDING_DEEP_LINK_KEYS = new Set(["lat", "lng", "z", "year", "l", "op", "poi", "label"]);

function hasOnboardingDeepLinkParams(search: string): boolean {
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (ONBOARDING_DEEP_LINK_KEYS.has(key)) return true;
  }
  return false;
}

declare global {
  interface Window {
    __chronomapDebug?: ChronomapDebugHook;
  }
}

function startApp(shareFallback: ShareFallback | null): void {
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
    featureFlags: { [KONJAKU_FEATURE_FLAG]: import.meta.env.VITE_ENABLE_KONJAKU },
  });
  const registryIds = new Set(layerRegistry.map((entry) => entry.id));
  const basemap: BasemapInfo = {
    id: GSI_BASEMAP_SOURCE_ID,
    title: { ja: "GSI 淡色地図", en: "GSI pale" },
    attribution: { text: GSI_ATTRIBUTION_TEXT, url: GSI_ATTRIBUTION_URL },
  };
  // Keep the POI credit visible while the provider registry grows in later waves. The row is
  // supplied as data to the sheet, so replacing this source with the registry is future-safe.
  const poiSource: PoiSourceInfo = {
    id: "wikipedia",
    title: { ja: "Wikipedia", en: "Wikipedia" },
    attribution: {
      text: "Wikipedia (CC BY-SA)",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  };
  let urlSync: ReturnType<typeof initUrlSync> | undefined;
  const runtime = bootstrap(app, now, {
    layerRegistry,
    basemap,
    poiSource,
    currentYear,
    beforeShell: (store) => {
      urlSync = initUrlSync(store, registryIds, { now });
      if (shareFallback !== null) {
        createActions(store).openImportSheet({
          prefill: shareFallback.prefill,
          reason: shareFallback.reason,
          autofocus: false,
        });
      }
    },
    mountMenuButton: (parent, store) =>
      mountMenuButton(parent, store, {
        registryIds,
        getSerialized: () => urlSync?.getSerialized() ?? "",
      }),
    mountToast,
    mountTimeSlider: (parent, store) =>
      mountTimeSlider(parent, store, { registry: layerRegistry, currentYear, now }),
    mountOpacityControl: (parent, store) => mountOpacityControl(parent, store),
    mountPoiToggle: (parent, store) => mountPoiToggle(parent, store),
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
  const initialLabel = urlSync?.getInitialLabel();
  if (initialLabel !== null && initialLabel !== undefined) {
    pointPicker.setPickedPoint(runtime.store.get().view, initialLabel);
  }

  // Onboarding is deliberately loaded only after the first map idle so it does not contribute to
  // the initial bundle or compete with the map's first interaction boundary. Deep links are the
  // exception: they must mark the first visit complete even when a stubbed/offline map never idles.
  let onboardingStarted = false;
  const startOnboarding = (): void => {
    if (onboardingStarted) return;
    onboardingStarted = true;
    unsubscribeOnboardingIdle();
    void import("./app/onboarding")
      .then(({ mountOnboarding }) => mountOnboarding(document.body, runtime.shell, store))
      .catch(() => {
        // A coach failure must never make the map shell unusable.
      });
  };
  const unsubscribeOnboardingIdle = mapController.onIdle(startOnboarding);
  // A fast deep-link bootstrap can settle before the idle listener is attached. The onboarding
  // module still stays lazy; deep-link detection is the only pre-idle fallback.
  if (hasOnboardingDeepLinkParams(window.location.search)) {
    queueMicrotask(startOnboarding);
  }

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
      getPoiScreenPoint: (id) => {
        const item = store.get().poi.items.find((candidate) => candidate.id === id);
        if (item === undefined) return null;
        const point = mapController.getMap().project([item.lng, item.lat]);
        return { x: point.x, y: point.y };
      },
    };
  }
}

const shareRoute = handleShareRoute({ basePath: import.meta.env.BASE_URL });
if (shareRoute.kind !== "redirect") {
  startApp(shareRoute.kind === "fallback" ? shareRoute.fallback : null);
}

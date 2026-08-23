import { mount, type AppShell } from "./appShell";
import { createOverlayManager, createMap, type MapController, type OverlayManager } from "../map";
import { initPoiController, type PoiController, type PoiProviderResolver } from "../map/poiLayer";
import type { LayerEntry } from "../providers/layers/types";
import { getPoiProvider } from "../providers/poi/registry";
import { mountPointPicker, type PointPickerController } from "./pointPicker";
import { createInitialState, type AppState } from "../state/appState";
import { createActions } from "../state/actions";
import { createStore, type Store } from "../state/store";
import {
  createSheetStub,
  mount as mountBottomSheet,
  type BottomSheetController,
  type SheetContentController,
  type SheetKind,
  type SheetRenderer,
} from "../ui/components/BottomSheet";
import {
  mount as mountLayerInfoBadge,
  type LayerInfoBadgeController,
} from "../ui/components/LayerInfoBadge";
import {
  mount as mountLayersSheet,
  type BasemapInfo,
  type PoiSourceInfo,
} from "../ui/components/LayersSheet";
import { mount as mountImportSheet } from "../ui/components/ImportSheet";
import { mount as mountPoiSheet } from "../ui/components/PoiSheet";
import { mountMenuButton } from "../ui/components/MenuButton";
import { mount as mountPoiToggle, type PoiToggleController } from "../ui/components/PoiToggle";
import { mount as mountToast, type ToastController } from "../ui/components/Toast";
import {
  mount as mountCoverageBanner,
  type CoverageBannerController,
} from "../ui/components/CoverageBanner";
import { initI18n } from "../ui/i18n";
import { mount as mountPoiErrorBanner } from "../ui/components/PoiErrorBanner";
import { createTimeWiring, type TimeWiringController } from "./timeWiring";
import { mountNetworkStatus } from "./networkStatus";
import { mount as mountA11yAnnouncer, type AnnouncerController } from "../ui/a11y/announcer";

export interface AppRuntime {
  readonly store: Store<AppState>;
  readonly shell: AppShell;
  readonly mapController: MapController;
  readonly overlayManager: OverlayManager | undefined;
  readonly timeWiring: TimeWiringController | null;
  readonly pointPicker: PointPickerController;
  readonly poiController: PoiController;
  readonly poiToggle: PoiToggleController;
  readonly toast: ToastController;
  readonly coverageBanner: CoverageBannerController | undefined;
  destroy(): void;
}

export interface BootstrapOptions {
  readonly layerRegistry?: readonly LayerEntry[];
  /** Allow synthetic shell measurements to omit non-critical coverage chrome. */
  readonly showCoverageBanner?: boolean;
  /** Optional complete registry used only for About credits; layer resolution remains unchanged. */
  readonly aboutRegistry?: readonly LayerEntry[];
  /** Lazily resolve the complete registry only when the About sheet is opened. */
  readonly aboutRegistryLoader?: () => Promise<readonly LayerEntry[]>;
  readonly basemap?: BasemapInfo;
  readonly poiSource?: PoiSourceInfo | null;
  readonly currentYear?: number;
  readonly beforeShell?: (store: Store<AppState>) => void;
  readonly mountMenuButton?: (parent: HTMLElement, store: Store<AppState>) => { destroy(): void };
  readonly mountToast?: (parent: HTMLElement, store: Store<AppState>) => { destroy(): void };
  readonly mountCoverageBanner?: (
    parent: HTMLElement,
    store: Store<AppState>,
    mapController: MapController,
    registry: readonly LayerEntry[],
  ) => CoverageBannerController;
  readonly mountTimeSlider?: (parent: HTMLElement, store: Store<AppState>) => { destroy(): void };
  readonly mountOpacityControl?: (
    parent: HTMLElement,
    store: Store<AppState>,
  ) => { destroy(): void };
  readonly mountLocateButton?: (
    parent: HTMLElement,
    store: Store<AppState>,
    mapController: MapController,
  ) => { destroy(): void };
  readonly mountPoiToggle?: (parent: HTMLElement, store: Store<AppState>) => PoiToggleController;
  readonly poiProvider?: PoiProviderResolver;
  readonly afterMap?: (runtime: {
    store: Store<AppState>;
    shell: AppShell;
    mapController: MapController;
  }) => void;
}

function createLazyAboutRenderer(
  registry: readonly LayerEntry[] | (() => Promise<readonly LayerEntry[]>),
  poiSource: PoiSourceInfo | null,
): SheetRenderer {
  return (parent, store): SheetContentController => {
    let destroyed = false;
    let loadingController: SheetContentController | null = createSheetStub("about")(parent, store);
    let aboutController: SheetContentController | null = null;

    const registryPromise =
      typeof registry === "function" ? Promise.resolve().then(registry) : Promise.resolve(registry);
    void Promise.all([import("../ui/components/AboutSheet"), registryPromise])
      .then(([{ mount }, resolvedRegistry]) => {
        if (destroyed) return;
        loadingController?.destroy();
        loadingController = null;
        aboutController = mount(parent, store, { registry: resolvedRegistry, poiSource });
      })
      .catch(() => {
        // Keep the safe loading stub if the optional About chunk cannot be loaded.
      });

    return {
      destroy() {
        destroyed = true;
        loadingController?.destroy();
        loadingController = null;
        aboutController?.destroy();
        aboutController = null;
      },
    };
  };
}

/** Create the production runtime, initializing locale state before any UI renders. */
export function bootstrap(
  parent: HTMLElement,
  now = new Date(),
  options: BootstrapOptions = {},
): AppRuntime {
  const store = createStore(createInitialState(now));
  const i18n = initI18n(store);
  const networkStatus = mountNetworkStatus(store);
  options.beforeShell?.(store);
  const shell = mount(parent, store);
  const menuButton = (options.mountMenuButton ?? mountMenuButton)(
    shell.getSlot("MenuButton"),
    store,
  );
  const toast: ToastController = (options.mountToast ?? mountToast)(
    shell.getSlot("toast-host"),
    store,
  );
  const mapController = createMap(shell.getSlot("map"), store);
  const poiController = initPoiController(
    mapController,
    store,
    options.poiProvider ?? getPoiProvider,
  );
  const poiErrorBanner = mountPoiErrorBanner(shell.getSlot("map-region"), store, () =>
    poiController.retry(),
  );
  const poiToggle = (options.mountPoiToggle ?? mountPoiToggle)(shell.getSlot("PoiToggle"), store);
  const overlayManager =
    options.layerRegistry === undefined
      ? undefined
      : createOverlayManager(mapController, store, options.layerRegistry);
  const timeWiring =
    options.layerRegistry === undefined
      ? null
      : createTimeWiring(store, mapController, options.layerRegistry, {
          ...(options.currentYear === undefined ? {} : { currentYear: options.currentYear }),
        });
  const mountCoverage =
    options.mountCoverageBanner ??
    ((
      parent: HTMLElement,
      stateStore: Store<AppState>,
      controller: MapController,
      registry: readonly LayerEntry[],
    ) => mountCoverageBanner(parent, stateStore, { mapController: controller, registry }));
  const coverageBanner =
    options.layerRegistry === undefined || options.showCoverageBanner === false
      ? undefined
      : mountCoverage(shell.getSlot("CoverageBanner"), store, mapController, options.layerRegistry);
  const timeSlider = options.mountTimeSlider?.(shell.getSlot("TimeSlider"), store);
  const opacityControl = options.mountOpacityControl?.(shell.getSlot("OpacityControl"), store);
  const a11yAnnouncer: AnnouncerController = mountA11yAnnouncer(parent, store, {
    ...(options.layerRegistry === undefined ? {} : { registry: options.layerRegistry }),
  });
  const pointPicker = mountPointPicker(shell.getSlot("map-region"), store, mapController);
  const sheetRenderers: Partial<Record<SheetKind, SheetRenderer>> = {
    import: (parent, sheetStore) =>
      mountImportSheet(parent, sheetStore, {
        onLocationOpened: (result) => {
          pointPicker.setPickedPoint({ lat: result.lat, lng: result.lng }, result.label);
        },
      }),
    poi: (parent, sheetStore) => mountPoiSheet(parent, sheetStore),
  };
  sheetRenderers.about = createLazyAboutRenderer(
    options.aboutRegistryLoader ?? options.aboutRegistry ?? options.layerRegistry ?? [],
    options.poiSource ?? null,
  );
  let layerInfoBadge: LayerInfoBadgeController | undefined;
  if (options.layerRegistry !== undefined && options.basemap !== undefined) {
    const registry = options.layerRegistry;
    const basemap = options.basemap;
    sheetRenderers.layers = (parent, sheetStore) =>
      mountLayersSheet(parent, sheetStore, {
        registry,
        basemap,
        poiSource: options.poiSource ?? null,
      });
    layerInfoBadge = mountLayerInfoBadge(shell.getSlot("LayerInfoBadge"), store, { registry });
  }
  const bottomSheet: BottomSheetController = mountBottomSheet(shell.getSlot("sheet-host"), store, {
    renderers: sheetRenderers,
  });
  const unsubscribePoiSelection = store.on(
    (state) => state.poi.selectedId,
    (next) => {
      if (next === null && store.get().ui.sheet === "poi") createActions(store).closeSheet();
    },
  );
  options.afterMap?.({ store, shell, mapController });
  const locateButton = options.mountLocateButton?.(
    shell.getSlot("LocateButton"),
    store,
    mapController,
  );

  return {
    store,
    shell,
    mapController,
    overlayManager,
    timeWiring,
    pointPicker,
    poiController,
    poiToggle,
    toast,
    coverageBanner,
    destroy() {
      pointPicker.destroy();
      poiController.destroy();
      poiErrorBanner.destroy();
      poiToggle.destroy();
      timeSlider?.destroy();
      opacityControl?.destroy();
      a11yAnnouncer.destroy();
      coverageBanner?.destroy();
      bottomSheet?.destroy();
      unsubscribePoiSelection();
      layerInfoBadge?.destroy();
      timeWiring?.destroy();
      overlayManager?.destroy();
      mapController.destroy();
      menuButton.destroy();
      toast.destroy();
      locateButton?.destroy();
      shell.destroy();
      i18n.destroy();
      networkStatus.destroy();
    },
  };
}

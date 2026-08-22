import { mount, type AppShell } from "./appShell";
import { createMap, type MapController } from "../map/mapController";
import { createInitialState, type AppState } from "../state/appState";
import { createStore, type Store } from "../state/store";
import { mountMenuButton } from "../ui/components/MenuButton";
import { showMapHandoffMenu, type MapHandoffMenuController } from "../ui/components/MapHandoffMenu";
import { mount as mountToast } from "../ui/components/Toast";
import { initI18n } from "../ui/i18n";

export interface AppRuntime {
  readonly store: Store<AppState>;
  readonly shell: AppShell;
  readonly mapController: MapController;
  destroy(): void;
}

export interface BootstrapOptions {
  readonly beforeShell?: (store: Store<AppState>) => void;
  readonly mountMenuButton?: (parent: HTMLElement, store: Store<AppState>) => { destroy(): void };
  readonly mountToast?: (parent: HTMLElement, store: Store<AppState>) => { destroy(): void };
  readonly mountLocateButton?: (
    parent: HTMLElement,
    store: Store<AppState>,
    mapController: MapController,
  ) => { destroy(): void };
  readonly afterMap?: (runtime: {
    store: Store<AppState>;
    shell: AppShell;
    mapController: MapController;
  }) => void;
}

/** Create the production runtime, initializing locale state before any UI renders. */
export function bootstrap(
  parent: HTMLElement,
  now = new Date(),
  options: BootstrapOptions = {},
): AppRuntime {
  const store = createStore(createInitialState(now));
  const i18n = initI18n(store);
  options.beforeShell?.(store);
  const shell = mount(parent, store);
  const menuButton = (options.mountMenuButton ?? mountMenuButton)(
    shell.getSlot("MenuButton"),
    store,
  );
  const toast = (options.mountToast ?? mountToast)(shell.getSlot("toast-host"), store);
  const mapController = createMap(shell.getSlot("map"), store);
  let handoffMenu: MapHandoffMenuController | undefined;
  const unsubscribeLongPress = mapController.onLongPress?.(({ lat, lng }) => {
    handoffMenu?.destroy();
    handoffMenu = showMapHandoffMenu(lat, lng, {
      parent: shell.getSlot("map-region"),
      store,
      zoom: Math.round(mapController.getMap().getZoom()),
      onClose: () => {
        handoffMenu = undefined;
      },
    });
  });
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
    destroy() {
      unsubscribeLongPress?.();
      handoffMenu?.destroy();
      mapController.destroy();
      menuButton.destroy();
      toast.destroy();
      locateButton?.destroy();
      shell.destroy();
      i18n.destroy();
    },
  };
}

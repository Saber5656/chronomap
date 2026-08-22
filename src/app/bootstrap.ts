import { mount, type AppShell } from "./appShell";
import { createMap, type MapController } from "../map/mapController";
import { createInitialState, type AppState } from "../state/appState";
import { createStore, type Store } from "../state/store";
import { mountMenuButton } from "../ui/components/MenuButton";
import { mount as mountToast } from "../ui/components/Toast";
import { initI18n } from "../ui/i18n";

export interface AppRuntime {
  readonly store: Store<AppState>;
  readonly shell: AppShell;
  readonly mapController: MapController;
  destroy(): void;
}

export interface BootstrapOptions {
  readonly mountLocateButton?: (
    parent: HTMLElement,
    store: Store<AppState>,
    mapController: MapController,
  ) => { destroy(): void };
}

/** Create the production runtime, initializing locale state before any UI renders. */
export function bootstrap(
  parent: HTMLElement,
  now = new Date(),
  options: BootstrapOptions = {},
): AppRuntime {
  const store = createStore(createInitialState(now));
  const i18n = initI18n(store);
  const shell = mount(parent, store);
  const menuButton = mountMenuButton(shell.getSlot("MenuButton"), store);
  const mapController = createMap(shell.getSlot("map"), store);
  const toast = mountToast(shell.getSlot("toast-host"), store);
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
      mapController.destroy();
      menuButton.destroy();
      toast.destroy();
      locateButton?.destroy();
      shell.destroy();
      i18n.destroy();
    },
  };
}

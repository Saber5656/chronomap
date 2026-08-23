import type { Store } from "../state/store";
import { el } from "../util/dom";

type ComponentSlotName =
  | "LocateButton"
  | "PoiToggle"
  | "MenuButton"
  | "CoverageBanner"
  | "LayerInfoBadge"
  | "TimeSlider"
  | "OpacityControl";

export type AppShellSlotName =
  | ComponentSlotName
  | "controls-top"
  | "map-region"
  | "slider-dock"
  | "sheet-host"
  | "toast-host"
  | "map";

export interface AppShell {
  getSlot(name: AppShellSlotName): HTMLElement;
  destroy(): void;
}

function createComponentSlot(name: ComponentSlotName, className: string): HTMLDivElement {
  return el("div", {
    class: `shell-slot ${className}`,
    "data-slot": name,
  });
}

/** Mount the shell topology into a parent and return its component handle. */
export function mount<S>(parent: HTMLElement, store: Store<S>): AppShell {
  void store;

  const locateButtonSlot = createComponentSlot("LocateButton", "locate-button-slot");
  const poiToggleSlot = createComponentSlot("PoiToggle", "poi-toggle-slot");
  const menuButtonSlot = createComponentSlot("MenuButton", "menu-button-slot");
  const controlsTop = el("header", { class: "controls-top", "data-slot": "controls-top" }, [
    locateButtonSlot,
    poiToggleSlot,
    menuButtonSlot,
  ]);

  const map = el("div", { id: "map", class: "map-canvas", "data-slot": "map" });
  const coverageBannerSlot = createComponentSlot("CoverageBanner", "coverage-banner-slot");
  const layerInfoBadgeSlot = createComponentSlot("LayerInfoBadge", "layer-info-badge-slot");
  const mapRegion = el("main", { class: "map-region", "data-slot": "map-region" }, [
    map,
    coverageBannerSlot,
    layerInfoBadgeSlot,
  ]);

  const timeSliderSlot = createComponentSlot("TimeSlider", "time-slider-slot");
  const opacityControlSlot = createComponentSlot("OpacityControl", "opacity-control-slot");
  const sliderDock = el("footer", { class: "slider-dock", "data-slot": "slider-dock" }, [
    timeSliderSlot,
    opacityControlSlot,
  ]);

  const sheetHost = el("div", { id: "sheet-host", "data-slot": "sheet-host" });
  const toastHost = el("div", { id: "toast-host", "data-slot": "toast-host" });
  const shell = el("div", { class: "shell" }, [
    controlsTop,
    mapRegion,
    sliderDock,
    sheetHost,
    toastHost,
  ]);

  // Remove only the server-rendered loading state; callers may own other children in the parent.
  for (const child of Array.from(parent.children)) {
    if (child.classList.contains("app-loading")) child.remove();
  }
  parent.append(shell);

  const slots: Partial<Record<AppShellSlotName, HTMLElement>> = {
    "controls-top": controlsTop,
    "map-region": mapRegion,
    "slider-dock": sliderDock,
    "sheet-host": sheetHost,
    "toast-host": toastHost,
    map,
    LocateButton: locateButtonSlot,
    PoiToggle: poiToggleSlot,
    MenuButton: menuButtonSlot,
    CoverageBanner: coverageBannerSlot,
    LayerInfoBadge: layerInfoBadgeSlot,
    TimeSlider: timeSliderSlot,
    OpacityControl: opacityControlSlot,
  };

  let destroyed = false;

  return {
    getSlot(name) {
      const slot = slots[name];
      if (slot === undefined) {
        throw new Error(`Unknown AppShell slot: ${name}`);
      }
      return slot;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shell.remove();
    },
  };
}

import {
  buildAppleMapsUrl,
  buildGeoUri,
  buildGoogleMapsUrl,
  mapHandoffTargets,
  openExternalWithResult,
  type MapHandoffTarget,
  type OutboundUrl,
} from "../../integrations/outbound";
import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { detectLocale, onLangChange, t, type I18nKey, type Locale } from "../i18n";

const TARGET_LABELS: Record<MapHandoffTarget, I18nKey> = {
  google: "handoff.google",
  apple: "handoff.apple",
  geo: "handoff.geo",
};

export interface MapHandoffMenuOptions {
  readonly parent?: HTMLElement;
  readonly store?: Store<AppState>;
  readonly zoom?: number;
  readonly onClose?: () => void;
}

export interface MapHandoffMenuController {
  destroy(): void;
}

let activeMenu: MapHandoffMenuController | undefined;

function buildTargetUrl(
  target: MapHandoffTarget,
  lat: number,
  lng: number,
  zoom?: number,
): OutboundUrl {
  if (target === "google") return buildGoogleMapsUrl(lat, lng);
  if (target === "apple") return buildAppleMapsUrl(lat, lng);
  return buildGeoUri(lat, lng, zoom);
}

function copyText(value: OutboundUrl): Promise<void> {
  const clipboard = navigator.clipboard;
  if (clipboard === undefined) return Promise.reject(new Error("Clipboard API unavailable."));
  return clipboard.writeText(value);
}

/**
 * Show the three hardcoded outbound actions for a validated map point.
 * The menu itself does not perform network I/O; every external navigation is a click-time action.
 */
export function showMapHandoffMenu(
  lat: number,
  lng: number,
  options: MapHandoffMenuOptions = {},
): MapHandoffMenuController {
  activeMenu?.destroy();

  const parent = options.parent ?? document.body;
  const ownerDocument = parent.ownerDocument;
  const opener =
    ownerDocument.activeElement instanceof HTMLElement ? ownerDocument.activeElement : null;
  const store = options.store;
  const actions = store === undefined ? undefined : createActions(store);
  const targets = mapHandoffTargets();
  const urls = new Map<MapHandoffTarget, OutboundUrl>();
  for (const target of targets) {
    urls.set(target, buildTargetUrl(target, lat, lng, options.zoom));
  }

  const popover = el("aside", {
    class: "map-handoff-popover",
    role: "menu",
    "aria-label": t("handoff.menuAria", {}, store?.get().ui.lang),
  });
  const buttons = new Map<MapHandoffTarget, HTMLButtonElement>();
  let destroyed = false;

  function locale(): Locale {
    return store?.get().ui.lang ?? detectLocale();
  }

  function render(): void {
    const currentLocale = locale();
    popover.setAttribute("aria-label", t("handoff.menuAria", {}, currentLocale));
    for (const [target, button] of buttons) {
      button.textContent = t(TARGET_LABELS[target], {}, currentLocale);
    }
  }

  function close(): void {
    if (destroyed) return;
    controller.destroy();
  }

  async function handleBlockedPopup(url: OutboundUrl): Promise<void> {
    let copied = false;
    try {
      await copyText(url);
      copied = true;
    } catch {
      copied = false;
    }

    if (actions === undefined) return;
    actions.showToast(
      copied ? "info" : "error",
      t(copied ? "handoff.popupBlocked" : "handoff.copyFailed", {}, locale()),
    );
  }

  function handleTargetClick(target: MapHandoffTarget): void {
    const url = urls.get(target);
    if (url === undefined) return;

    const opened = openExternalWithResult(url);
    close();
    if (!opened) void handleBlockedPopup(url);
  }

  for (const target of targets) {
    const button = el("button", {
      type: "button",
      role: "menuitem",
      class: "map-handoff-popover__item",
      "data-handoff-target": target,
    });
    button.addEventListener("click", () => handleTargetClick(target));
    buttons.set(target, button);
    popover.append(button);
  }

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!popover.contains(event.target as Node)) close();
  };
  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  parent.append(popover);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeyDown);
  const unsubscribeLanguage = store === undefined ? undefined : onLangChange(store, render);
  render();
  buttons.values().next().value?.focus();

  const controller: MapHandoffMenuController = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      unsubscribeLanguage?.();
      popover.remove();
      if (activeMenu === controller) activeMenu = undefined;
      options.onClose?.();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    },
  };
  activeMenu = controller;
  return controller;
}

import { createActions } from "../../state/actions";
import { POI_MIN_ZOOM, type AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type Locale } from "../i18n";

export const POI_ZOOM_HINT_SESSION_KEY = "chronomap.poi.zoomHintShown";

export interface PoiToggleController {
  destroy(): void;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function svgElement(document: Document, name: string): SVGElement {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function setSvgAttributes(element: SVGElement, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function createPinIcon(document: Document): SVGElement {
  const icon = svgElement(document, "svg");
  setSvgAttributes(icon, {
    class: "poi-toggle__icon",
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    "aria-hidden": "true",
    focusable: "false",
  });
  const pin = svgElement(document, "path");
  setSvgAttributes(pin, {
    d: "M12 21s7-6.16 7-12A7 7 0 0 0 5 9c0 5.84 7 12 7 12Z",
    fill: "none",
    stroke: "currentColor",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "1.8",
  });
  const center = svgElement(document, "circle");
  setSvgAttributes(center, {
    cx: "12",
    cy: "9",
    r: "2.2",
    fill: "currentColor",
  });
  icon.append(pin, center);
  return icon;
}

function sessionHintAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(POI_ZOOM_HINT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSessionHintShown(): void {
  try {
    sessionStorage.setItem(POI_ZOOM_HINT_SESSION_KEY, "1");
  } catch {
    /* Session storage can be disabled in private browsing or an embedded document. */
  }
}

/** Mount the top-corner POI toggle and its once-per-session zoom hint. */
export function mount(parent: HTMLElement, store: Store<AppState>): PoiToggleController {
  const actions = createActions(store);
  const ownerDocument = parent.ownerDocument;
  const root = el("div", { class: "poi-toggle" });
  const button = el("button", {
    class: "poi-toggle__button",
    type: "button",
    "data-poi-toggle": "true",
  });
  const hint = el("span", {
    class: "poi-toggle__hint",
    role: "status",
    "aria-live": "polite",
    "data-poi-zoom-hint": "true",
  });
  button.append(createPinIcon(ownerDocument));
  root.append(button, hint);
  parent.append(root);

  let destroyed = false;
  let hintShown = sessionHintAlreadyShown();
  let hintVisible = false;

  function locale(): Locale {
    return store.get().ui.lang;
  }

  function updateHintVisibility(): void {
    const shouldShow =
      store.get().poi.enabled && store.get().view.zoom < POI_MIN_ZOOM && !hintShown;
    if (shouldShow) {
      hintShown = true;
      hintVisible = true;
      markSessionHintShown();
      return;
    }
    if (!store.get().poi.enabled || store.get().view.zoom >= POI_MIN_ZOOM) hintVisible = false;
  }

  function render(): void {
    if (destroyed) return;
    updateHintVisibility();
    const enabled = store.get().poi.enabled;
    const currentLocale = locale();
    const label = t("poi.aria", {}, currentLocale);
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("data-state", enabled ? "enabled" : "disabled");
    hint.textContent = t("poi.zoomHint", {}, currentLocale);
    hint.hidden = !hintVisible;
  }

  const unsubscribeEnabled = store.on((state) => state.poi.enabled, render);
  const unsubscribeZoom = store.on((state) => state.view.zoom, render);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, render);
  const handleClick = (): void => {
    if (destroyed) return;
    actions.setPoiEnabled(!store.get().poi.enabled);
  };
  button.addEventListener("click", handleClick);
  render();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeEnabled();
      unsubscribeZoom();
      unsubscribeLanguage();
      button.removeEventListener("click", handleClick);
      root.remove();
    },
  };
}

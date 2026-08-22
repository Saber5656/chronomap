import {
  GeoError,
  isGeolocationAvailable,
  requestFix,
  type Fix,
  type GeoErrorStatus,
} from "../../map/geolocation";
import type { MapController } from "../../map/mapController";
import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type I18nKey } from "../i18n";

export const GEO_I18N_KEYS = {
  idleAria: "geo.locate.aria",
  requestingAria: "geo.requesting.aria",
  grantedAria: "geo.granted.aria",
  deniedAria: "geo.denied.aria",
  deniedTitle: "geo.denied.title",
  deniedBody: "geo.denied.body",
  timeout: "geo.timeout",
} as const satisfies Record<string, I18nKey>;

export type GeoI18nKey = (typeof GEO_I18N_KEYS)[keyof typeof GEO_I18N_KEYS];
export type LocateMapController = Pick<MapController, "flyToUser"> &
  Partial<Pick<MapController, "setUserFix">>;

export interface LocateButtonOptions {
  mapController?: LocateMapController;
  requestFix?: () => Promise<Fix>;
  translate?: (key: GeoI18nKey, lang: AppState["ui"]["lang"]) => string;
}

export interface LocateButton {
  destroy(): void;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

let nextInstanceId = 0;

function defaultTranslate(key: GeoI18nKey, lang: AppState["ui"]["lang"]): string {
  return t(key, {}, lang);
}

function createSvgElement(name: string): SVGElement {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function setSvgAttributes(element: SVGElement, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function createIcon(status: Exclude<AppState["geo"]["status"], "unavailable">): SVGElement {
  const svg = createSvgElement("svg");
  setSvgAttributes(svg, {
    class: "locate-button__icon",
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    "aria-hidden": "true",
    focusable: "false",
  });

  if (status === "idle") {
    const circle = createSvgElement("circle");
    setSvgAttributes(circle, { cx: "12", cy: "12", r: "5" });
    const vertical = createSvgElement("path");
    setSvgAttributes(vertical, { d: "M12 2v5M12 17v5" });
    const horizontal = createSvgElement("path");
    setSvgAttributes(horizontal, { d: "M2 12h5M17 12h5" });
    svg.append(circle, vertical, horizontal);
  } else if (status === "requesting") {
    const spinner = createSvgElement("circle");
    setSvgAttributes(spinner, { cx: "12", cy: "12", r: "8", "data-icon": "spinner" });
    svg.append(spinner);
  } else if (status === "granted") {
    const circle = createSvgElement("circle");
    setSvgAttributes(circle, { cx: "12", cy: "12", r: "8", "data-icon": "filled" });
    const dot = createSvgElement("circle");
    setSvgAttributes(dot, { cx: "12", cy: "12", r: "3", "data-icon": "dot" });
    svg.append(circle, dot);
  } else {
    const circle = createSvgElement("circle");
    setSvgAttributes(circle, { cx: "12", cy: "12", r: "8" });
    const slash = createSvgElement("path");
    setSvgAttributes(slash, { d: "M5 5l14 14", "data-icon": "slashed" });
    svg.append(circle, slash);
  }

  for (const child of [...svg.children]) {
    setSvgAttributes(child as SVGElement, {
      fill: "none",
      stroke: "currentColor",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-width": "2",
    });
  }
  return svg;
}

function normalizeOptions(
  options: LocateButtonOptions | LocateMapController | undefined,
): LocateButtonOptions {
  if (options !== undefined && "flyToUser" in options) return { mapController: options };
  return options ?? {};
}

function statusFromError(error: unknown): GeoErrorStatus {
  if (error instanceof GeoError) return error.status;
  return "unavailable";
}

/** Mounts the explicit, single-fix location control into the LocateButton shell slot. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options?: LocateButtonOptions | LocateMapController,
): LocateButton {
  const normalized = normalizeOptions(options);
  const actions = createActions(store);
  const translate = normalized.translate ?? defaultTranslate;
  const instanceId = nextInstanceId + 1;
  nextInstanceId = instanceId;
  const deniedTitleId = `locate-denied-title-${instanceId}`;
  const deniedBodyId = `locate-denied-body-${instanceId}`;

  const button = el("button", {
    class: "locate-button",
    type: "button",
    "aria-controls": `locate-denied-popover-${instanceId}`,
  });
  const title = el("h2", { id: deniedTitleId, class: "locate-popover__title" });
  const body = el("p", { id: deniedBodyId, class: "locate-popover__body" });
  const popover = el(
    "aside",
    {
      id: `locate-denied-popover-${instanceId}`,
      class: "locate-popover",
      role: "dialog",
      "aria-labelledby": deniedTitleId,
      "aria-describedby": deniedBodyId,
    },
    [title, body],
  );
  const root = el("div", { class: "locate-control" }, [button, popover]);
  parent.append(root);

  let destroyed = false;
  let popoverOpen = false;
  let deniedExplainerShown = false;
  let requestSequence = 0;

  function render(): void {
    const status = store.get().geo.status;
    const visibleStatus = status === "unavailable" ? "idle" : status;
    const lang = store.get().ui.lang;
    const labelKey =
      visibleStatus === "requesting"
        ? GEO_I18N_KEYS.requestingAria
        : visibleStatus === "granted"
          ? GEO_I18N_KEYS.grantedAria
          : visibleStatus === "denied"
            ? GEO_I18N_KEYS.deniedAria
            : GEO_I18N_KEYS.idleAria;

    root.hidden = status === "unavailable";
    button.disabled = status === "requesting";
    button.dataset.state = visibleStatus;
    button.setAttribute("aria-label", translate(labelKey, lang));
    button.setAttribute("aria-expanded", String(status === "denied" && popoverOpen));
    button.replaceChildren(createIcon(visibleStatus));

    title.textContent = translate(GEO_I18N_KEYS.deniedTitle, lang);
    body.textContent = translate(GEO_I18N_KEYS.deniedBody, lang);
    const showPopover = status === "denied" && popoverOpen;
    popover.hidden = !showPopover;
    popover.setAttribute("aria-hidden", String(!showPopover));
  }

  function setPopoverOpen(open: boolean): void {
    popoverOpen = open;
    render();
  }

  async function acquireFix(): Promise<void> {
    if (destroyed || store.get().geo.status === "requesting") return;

    const sequence = requestSequence + 1;
    requestSequence = sequence;
    setPopoverOpen(false);
    actions.setGeoStatus("requesting");

    try {
      const fix = await (normalized.requestFix ?? requestFix)();
      if (destroyed || sequence !== requestSequence) return;

      actions.setFix(fix);
      actions.setGeoStatus("granted");
      normalized.mapController?.setUserFix?.(fix);
      normalized.mapController?.flyToUser(fix);
    } catch (error: unknown) {
      if (destroyed || sequence !== requestSequence) return;

      const status = statusFromError(error);
      if (status === "timeout") {
        actions.setGeoStatus("idle");
        actions.showToast("error", translate(GEO_I18N_KEYS.timeout, store.get().ui.lang));
      } else {
        actions.setGeoStatus(status);
      }
    }
  }

  function handleButtonClick(): void {
    const status = store.get().geo.status;
    if (status === "requesting" || status === "unavailable") return;
    if (status === "denied") {
      if (!deniedExplainerShown) {
        deniedExplainerShown = true;
        setPopoverOpen(true);
      } else {
        void acquireFix();
      }
      return;
    }
    void acquireFix();
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    if (popoverOpen && event.target instanceof Node && !root.contains(event.target)) {
      setPopoverOpen(false);
    }
  }

  function handleDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && popoverOpen) setPopoverOpen(false);
  }

  const unsubscribeStatus = store.on((state) => state.geo.status, render);
  const unsubscribeLang = store.on((state) => state.ui.lang, render);
  button.addEventListener("click", handleButtonClick);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeyDown);

  if (normalized.requestFix === undefined && !isGeolocationAvailable()) {
    actions.setGeoStatus("unavailable");
  } else {
    render();
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      requestSequence += 1;
      unsubscribeStatus();
      unsubscribeLang();
      button.removeEventListener("click", handleButtonClick);
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      root.remove();
    },
  };
}

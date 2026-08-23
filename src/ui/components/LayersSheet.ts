import type { LayerEntry } from "../../providers/layers/types";
import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type Locale } from "../i18n";

export interface LocalizedLabel {
  readonly ja: string;
  readonly en: string;
}

export interface BasemapInfo {
  readonly id: string;
  readonly title: LocalizedLabel;
  readonly attribution: {
    readonly text: string;
    readonly url: string;
  };
}

export interface PoiSourceInfo {
  readonly id: string;
  readonly title: LocalizedLabel;
  readonly attribution: {
    readonly text: string;
    readonly url: string;
  };
  readonly license?: {
    readonly text: string;
    readonly url: string;
  };
}

export interface LayersSheetOptions {
  readonly registry: readonly LayerEntry[];
  readonly basemap: BasemapInfo;
  readonly poiSource: PoiSourceInfo | null;
}

export interface LayersSheetController {
  destroy(): void;
}

function safeHttpsUrl(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
    return value;
  } catch {
    return null;
  }
}

function externalLink(text: string, url: string | undefined): HTMLElement {
  const safeUrl = safeHttpsUrl(url);
  if (safeUrl === null) return el("span", { class: "layers-sheet__plain-text" }, text);
  return el(
    "a",
    {
      href: safeUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    text,
  );
}

function labeledValue(label: string, value: HTMLElement | string): HTMLElement {
  const row = el("p", { class: "layers-sheet__value" });
  row.append(el("span", { class: "layers-sheet__label" }, `${label}: `));
  row.append(typeof value === "string" ? document.createTextNode(value) : value);
  return row;
}

function layerEra(entry: LayerEntry): string {
  return `${entry.era.from}–${entry.era.to}`;
}

function layerRow(
  entry: LayerEntry,
  locale: Locale,
  labels: {
    readonly active: string;
    readonly attribution: string;
    readonly license: string;
    readonly provider: string;
  },
): HTMLElement {
  const title = el("strong", { class: "layers-sheet__title" }, entry.title[locale]);
  if (entry.flags.experimental) {
    title.append(
      el(
        "span",
        { class: "layers-sheet__chip", "data-chip": "experimental" },
        t("layers.experimental", {}, locale),
      ),
    );
  }

  const row = el("section", { class: "layers-sheet__row", "data-layer-row": "active-layer" });
  row.append(
    el("h3", { class: "layers-sheet__row-heading" }, [
      el("span", { class: "layers-sheet__section-label" }, labels.active),
      title,
    ]),
    labeledValue(t("layers.era", {}, locale), layerEra(entry)),
    labeledValue(labels.provider, entry.provider),
    labeledValue(labels.attribution, externalLink(entry.attribution.text, entry.attribution.url)),
    labeledValue(
      labels.license,
      externalLink(entry.attribution.license.name, entry.attribution.license.url),
    ),
  );
  return row;
}

function sourceRow(
  kind: "basemap" | "poi",
  sectionLabel: string,
  title: string,
  attribution: { readonly text: string; readonly url: string },
  labels: { readonly attribution: string },
): HTMLElement {
  const row = el("section", { class: "layers-sheet__row", "data-layer-row": kind });
  row.append(
    el("h3", { class: "layers-sheet__row-heading" }, [
      el("span", { class: "layers-sheet__section-label" }, sectionLabel),
      el("strong", { class: "layers-sheet__title" }, title),
    ]),
    labeledValue(labels.attribution, externalLink(attribution.text, attribution.url)),
  );
  return row;
}

/** Render registry-backed layer credits inside the generic BottomSheet host. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: LayersSheetOptions,
): LayersSheetController {
  const root = el("div", { class: "layers-sheet" });
  const actions = createActions(store);
  parent.append(root);

  function handleAboutClick(): void {
    actions.openSheet("about");
  }

  function render(): void {
    const locale: Locale = store.get().ui.lang;
    const labels = {
      active: t("layers.active", {}, locale),
      attribution: t("layers.attribution", {}, locale),
      basemap: t("layers.basemap", {}, locale),
      license: t("layers.license", {}, locale),
      poi: t("layers.poi", {}, locale),
      provider: t("layers.provider", {}, locale),
    };
    const activeLayer = options.registry.find(
      (entry) => entry.id === store.get().timeLayer.activeLayerId,
    );
    const content: HTMLElement[] = [
      sourceRow(
        "basemap",
        labels.basemap,
        options.basemap.title[locale],
        options.basemap.attribution,
        labels,
      ),
    ];
    if (activeLayer !== undefined) content.push(layerRow(activeLayer, locale, labels));
    if (options.poiSource !== null) {
      content.push(
        sourceRow(
          "poi",
          labels.poi,
          options.poiSource.title[locale],
          options.poiSource.attribution,
          labels,
        ),
      );
    }

    const footer = el("footer", { class: "layers-sheet__footer" });
    const aboutButton = el(
      "button",
      {
        type: "button",
        class: "layers-sheet__about-link",
        "data-sheet-link": "about",
      },
      t("layers.about", {}, locale),
    );
    aboutButton.addEventListener("click", handleAboutClick);
    footer.append(aboutButton);
    root.replaceChildren(
      el("p", { class: "layers-sheet__description" }, t("layers.description", {}, locale)),
      ...content,
      footer,
    );
  }

  const unsubscribeActiveLayer = store.on((state) => state.timeLayer.activeLayerId, render);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, render);
  render();

  return {
    destroy() {
      unsubscribeActiveLayer();
      unsubscribeLanguage();
      root.remove();
    },
  };
}

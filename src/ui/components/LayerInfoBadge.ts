import type { LayerEntry } from "../../providers/layers/types";
import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type Locale } from "../i18n";

export interface LayerInfoBadgeOptions {
  readonly registry: readonly LayerEntry[];
}

export interface LayerInfoBadgeController {
  destroy(): void;
}

function eraLabel(entry: LayerEntry): string {
  return `${entry.era.from}–${entry.era.to}`;
}

/** Show the active era and layer title, with the layer sheet as its affordance. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: LayerInfoBadgeOptions,
): LayerInfoBadgeController {
  const actions = createActions(store);
  const badge = el("button", {
    type: "button",
    class: "layer-info-badge",
    "aria-haspopup": "dialog",
    "data-layer-id": "",
  });
  parent.append(badge);

  function render(): void {
    const state = store.get();
    const locale: Locale = state.ui.lang;
    const entry = options.registry.find(
      (candidate) => candidate.id === state.timeLayer.activeLayerId,
    );
    const text =
      entry === undefined
        ? t("badge.presentDay", {}, locale)
        : `${eraLabel(entry)} · ${entry.title[locale]}`;

    badge.textContent = text;
    badge.setAttribute("aria-label", text);
    badge.dataset.layerId = entry?.id ?? "present-day";
  }

  const handleClick = (): void => {
    actions.openSheet("layers");
  };
  const unsubscribeLayer = store.on((state) => state.timeLayer.activeLayerId, render);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, render);
  badge.addEventListener("click", handleClick);
  render();

  return {
    destroy() {
      unsubscribeLayer();
      unsubscribeLanguage();
      badge.removeEventListener("click", handleClick);
      badge.remove();
    },
  };
}

import { fetchPoiDetail } from "../../providers/poi/wikipediaSummary";
import { showMapHandoffMenu, type MapHandoffMenuController } from "./MapHandoffMenu";
import type { Poi, PoiDetail } from "../../providers/poi/types";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { formatDistance, t, type Locale } from "../i18n";

export interface PoiSheetOptions {
  readonly fetchDetail?: (poi: Poi, options: { signal: AbortSignal }) => Promise<PoiDetail>;
}
export interface PoiSheetController {
  destroy(): void;
  focus?(): void;
}

function safeWikipediaUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^(?:[a-z]{2,3}\.)?wikipedia\.org$/u.test(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function skeleton(): HTMLElement {
  const lines = el("div", { class: "poi-sheet__skeleton", "aria-hidden": "true" });
  for (let i = 0; i < 3; i += 1) lines.append(el("span"));
  return el("div", { class: "poi-sheet__body poi-sheet__body--loading" }, [
    el("div", {
      class: "poi-sheet__thumbnail poi-sheet__thumbnail--placeholder",
      "aria-hidden": "true",
    }),
    lines,
  ]);
}

export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: PoiSheetOptions = {},
): PoiSheetController {
  const root = el("article", { class: "poi-sheet", tabindex: "-1" });
  parent.append(root);
  const fetchDetail =
    options.fetchDetail ?? ((poi, fetchOptions) => fetchPoiDetail(poi, fetchOptions));
  let requestController: AbortController | null = null;
  let handoffController: MapHandoffMenuController | null = null;
  let destroyed = false;
  let requestNumber = 0;
  const selected = (): Poi | undefined => {
    const id = store.get().poi.selectedId;
    return id === null ? undefined : store.get().poi.items.find((item) => item.id === id);
  };
  const heading = (poi: Poi, locale: Locale): HTMLElement =>
    el("div", { class: "poi-sheet__heading" }, [
      el("h3", { class: "poi-sheet__name" }, poi.title),
      el(
        "span",
        { class: "poi-sheet__distance" },
        t("poi.distance", { distance: formatDistance(poi.distanceM ?? 0, locale) }, locale),
      ),
    ]);
  function load(poi: Poi): void {
    requestController?.abort();
    handoffController?.destroy();
    handoffController = null;
    const controller = new AbortController();
    requestController = controller;
    const current = ++requestNumber;
    const locale = store.get().ui.lang;
    root.replaceChildren(heading(poi, locale), skeleton());
    void fetchDetail(poi, { signal: controller.signal })
      .then((detail) => {
        if (
          destroyed ||
          controller.signal.aborted ||
          current !== requestNumber ||
          selected()?.id !== poi.id
        )
          return;
        const box = el("div", { class: "poi-sheet__thumbnail" });
        if (detail.thumbnailUrl !== undefined) {
          const image = el("img", {
            src: detail.thumbnailUrl,
            loading: "lazy",
            referrerpolicy: "no-referrer",
            alt: poi.title,
          });
          image.addEventListener("error", () => {
            box.replaceChildren();
            box.hidden = true;
          });
          box.append(image);
        } else box.hidden = true;
        const extract = el("p", { class: "poi-sheet__extract" });
        extract.textContent = detail.extract;
        const actions = el("div", { class: "poi-sheet__actions" });
        const pageUrl = safeWikipediaUrl(detail.pageUrl);
        if (pageUrl !== null)
          actions.append(
            el(
              "a",
              { href: pageUrl, target: "_blank", rel: "noopener noreferrer" },
              t("poi.readOnWikipedia", {}, locale),
            ),
          );
        const mapButton = el(
          "button",
          { type: "button", "data-poi-action": "open-in-maps" },
          t("poi.openInMaps", {}, locale),
        );
        mapButton.addEventListener("click", () => {
          handoffController?.destroy();
          handoffController = showMapHandoffMenu(poi.lat, poi.lng, {
            parent: root,
            store,
            zoom: 16,
          });
        });
        actions.append(mapButton);
        const footer = el("footer", { class: "poi-sheet__footer" });
        if (pageUrl !== null)
          footer.append(
            el(
              "a",
              { href: pageUrl, target: "_blank", rel: "noopener noreferrer" },
              t("poi.attribution", {}, locale),
            ),
          );
        root.replaceChildren(
          heading(poi, locale),
          el("div", { class: "poi-sheet__body" }, [box, extract]),
          actions,
          footer,
        );
      })
      .catch(() => {
        if (
          destroyed ||
          controller.signal.aborted ||
          current !== requestNumber ||
          selected()?.id !== poi.id
        )
          return;
        const button = el(
          "button",
          { type: "button", class: "poi-sheet__retry" },
          t("common.retry", {}, store.get().ui.lang),
        );
        button.addEventListener("click", () => load(poi));
        root.replaceChildren(
          el("p", { role: "alert" }, t("poi.detailError", {}, store.get().ui.lang)),
          button,
        );
      });
  }
  const render = (): void => {
    const poi = selected();
    if (poi === undefined) {
      requestController?.abort();
      handoffController?.destroy();
      handoffController = null;
      requestNumber += 1;
      root.replaceChildren();
      return;
    }
    load(poi);
  };
  const unsubscribeSelection = store.on((state) => state.poi.selectedId, render);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, render);
  render();
  return {
    destroy() {
      destroyed = true;
      requestNumber += 1;
      requestController?.abort();
      handoffController?.destroy();
      handoffController = null;
      unsubscribeSelection();
      unsubscribeLanguage();
      root.remove();
    },
    focus() {
      const target = root.querySelector<HTMLElement>("a,button");
      if (target !== null) target.focus();
      else root.focus();
    },
  };
}

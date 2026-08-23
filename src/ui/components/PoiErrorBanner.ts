import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t } from "../i18n";

export interface PoiErrorBannerController {
  destroy(): void;
}

export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  retry: () => void,
): PoiErrorBannerController {
  const root = el("div", {
    class: "poi-error-banner",
    "aria-live": "polite",
    hidden: true,
  });
  const message = el("span", { class: "poi-error-banner__message" });
  const button = el("button", { type: "button", class: "poi-error-banner__retry" });
  root.append(message, button);
  parent.append(root);

  const render = (): void => {
    const state = store.get();
    const error = state.poi.status === "error";
    root.hidden = !error;
    if (!error) {
      root.removeAttribute("role");
      return;
    }
    root.setAttribute("role", "alert");
    message.textContent = t("poi.fetchError", {}, state.ui.lang);
    button.textContent = t("common.retry", {}, state.ui.lang);
  };
  const handleClick = (): void => {
    retry();
  };
  button.addEventListener("click", handleClick);
  const unsubscribeStatus = store.on((state) => state.poi.status, render);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, render);
  render();

  return {
    destroy() {
      unsubscribeStatus();
      unsubscribeLanguage();
      button.removeEventListener("click", handleClick);
      root.remove();
    },
  };
}

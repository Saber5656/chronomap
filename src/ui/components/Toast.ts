import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";

const TOAST_DURATION_MS = 4_000;

export interface ToastController {
  destroy(): void;
}

/** Render the current store toast into the shell's single toast host. */
export function mount(parent: HTMLElement, store: Store<AppState>): ToastController {
  const element = el("div", {
    class: "toast",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
    hidden: true,
  });
  parent.append(element);

  let destroyed = false;
  let dismissTimer: number | undefined;

  function cancelDismiss(): void {
    if (dismissTimer === undefined) return;
    window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
  }

  function render(): void {
    if (destroyed) return;
    cancelDismiss();

    const toast = store.get().ui.toast;
    if (toast === null) {
      element.hidden = true;
      element.textContent = "";
      element.removeAttribute("data-kind");
      return;
    }

    element.hidden = false;
    element.dataset.kind = toast.kind;
    element.textContent = toast.text;
    dismissTimer = window.setTimeout(() => {
      dismissTimer = undefined;
      if (!destroyed) element.hidden = true;
    }, TOAST_DURATION_MS);
  }

  const unsubscribe = store.on((state) => state.ui.toast, render);
  render();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      cancelDismiss();
      element.remove();
    },
  };
}

import type { AppState } from "../../state/appState";
import { createActions } from "../../state/actions";
import type { ToastAction } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";

export const TOAST_DURATION_MS = 4_000;
export const ACTION_TOAST_DURATION_MS = 8_000;

export interface ActionToastOptions {
  readonly label: string;
  readonly onAction: () => void;
  readonly onDismiss?: () => void;
}

export interface ToastController {
  destroy(): void;
  showToast?: (kind: "info" | "error", text: string) => void;
  showActionToast?: (kind: "info" | "error", text: string, action: ActionToastOptions) => void;
}

/** Render the current store toast into the shell's single toast host. */
export function mount(parent: HTMLElement, store: Store<AppState>): ToastController {
  const actions = createActions(store);
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
  let renderedToastId: number | null = null;
  const queue: NonNullable<AppState["ui"]["toast"]>[] = [];
  const seen = new Set<number>();

  function cancelDismiss(): void {
    if (dismissTimer === undefined) return;
    window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
  }

  function render(): void {
    if (destroyed) return;

    const incoming = store.get().ui.toast;
    if (
      incoming !== null &&
      !seen.has(incoming.id) &&
      !queue.some((item) => item.id === incoming.id)
    ) {
      seen.add(incoming.id);
      queue.push(incoming);
      if (queue.length > 4) {
        const dropped = queue.splice(1, 1)[0];
        dropped?.action?.onDismiss?.();
      }
    }
    const toast = queue[0] ?? null;
    if (toast === null) {
      cancelDismiss();
      renderedToastId = null;
      element.hidden = true;
      element.textContent = "";
      element.removeAttribute("data-kind");
      return;
    }

    const changed = renderedToastId !== toast.id;
    if (changed) {
      cancelDismiss();
      renderedToastId = toast.id;
    }

    element.hidden = false;
    element.dataset.kind = toast.kind;
    const message = el("span", { class: "toast__message" }, toast.text);
    element.replaceChildren(message);
    if (toast.action !== undefined) {
      const action = el(
        "button",
        {
          type: "button",
          class: "toast__action",
        },
        toast.action.label,
      );
      const handleAction = (): void => {
        if (queue[0]?.id !== toast.id) return;
        queue.shift();
        render();
        toast.action?.onAction();
        toast.action?.onDismiss?.();
      };
      action.addEventListener("click", handleAction);
      element.append(action);
    }
    if (changed) {
      dismissTimer = window.setTimeout(
        () => {
          dismissTimer = undefined;
          renderedToastId = null;
          const dismissed = queue.shift();
          dismissed?.action?.onDismiss?.();
          if (!destroyed) render();
        },
        toast.action === undefined ? TOAST_DURATION_MS : ACTION_TOAST_DURATION_MS,
      );
    }
  }

  const unsubscribe = store.on((state) => state.ui.toast, render);
  render();

  return {
    showToast(kind, text) {
      actions.showToast(kind, text);
    },
    showActionToast(kind, text, action: ActionToastOptions) {
      const toastAction: ToastAction = {
        label: action.label,
        onAction: action.onAction,
        ...(action.onDismiss === undefined ? {} : { onDismiss: action.onDismiss }),
      };
      actions.showToast(kind, text, toastAction);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      cancelDismiss();
      element.remove();
    },
  };
}

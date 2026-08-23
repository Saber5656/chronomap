import { t } from "../ui/i18n";
import type { ToastController } from "../ui/components/Toast";
import { el } from "../util/dom";

const OFFLINE_READY_DURATION_MS = 4_000;

export interface RegisterSWOptions {
  readonly immediate?: boolean;
  readonly onNeedRefresh?: () => void;
  readonly onOfflineReady?: () => void;
}

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;
export type RegisterServiceWorker = (options?: RegisterSWOptions) => UpdateServiceWorker;

export interface ServiceWorkerUpdateController {
  destroy(): void;
}

function createToast(attributes: Readonly<Record<string, string>>): HTMLDivElement {
  return el("div", {
    class: "toast",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
    ...attributes,
  });
}

/** Mount the small Issue #32 update boundary without changing the Issue #40 Toast contract. */
export function mountServiceWorkerUpdate(
  parent: HTMLElement,
  registerSW: RegisterServiceWorker,
  toastController?: Pick<ToastController, "showToast" | "showActionToast">,
): ServiceWorkerUpdateController {
  let destroyed = false;
  let offlineReadyShown = false;
  let offlineReadyToast: HTMLDivElement | null = null;
  let updateToast: HTMLDivElement | null = null;
  let offlineReadyTimer: number | undefined;
  let updateAction: HTMLButtonElement | null = null;
  let updateHandler: (() => void) | null = null;

  function clearOfflineReadyTimer(): void {
    if (offlineReadyTimer === undefined) return;
    window.clearTimeout(offlineReadyTimer);
    offlineReadyTimer = undefined;
  }

  function removeOfflineReadyToast(): void {
    clearOfflineReadyTimer();
    offlineReadyToast?.remove();
    offlineReadyToast = null;
  }

  function showOfflineReady(): void {
    if (destroyed || offlineReadyShown) return;
    offlineReadyShown = true;

    if (toastController?.showToast !== undefined) {
      toastController.showToast("info", t("sw.offlineReady"));
      return;
    }

    const toast = createToast({
      class: "sw-offline-ready-toast",
      "data-sw-offline-ready": "true",
    });
    toast.append(document.createTextNode(t("sw.offlineReady")));
    parent.append(toast);
    offlineReadyToast = toast;
    offlineReadyTimer = window.setTimeout(removeOfflineReadyToast, OFFLINE_READY_DURATION_MS);
  }

  function showUpdateAvailable(): void {
    if (destroyed || updateToast !== null) return;

    const handleUpdate = (): void => {
      // The shared Toast removes the action item before invoking this callback.
      // Clear the sentinel as well so a failed update can present a retry prompt.
      updateToast = null;
      void updateServiceWorker(true).catch(() => {
        if (!destroyed) showUpdateAvailable();
      });
    };
    if (toastController?.showActionToast !== undefined) {
      updateToast = document.createElement("div");
      toastController.showActionToast("info", t("sw.updateReady"), {
        label: t("sw.reload"),
        onAction: handleUpdate,
        onDismiss: () => {
          updateToast = null;
        },
      });
      return;
    }

    const toast = createToast({ class: "toast sw-update-toast", "data-sw-update": "true" });
    const message = el("span", { class: "sw-update-toast__message" }, t("sw.updateReady"));
    const action = el(
      "button",
      {
        type: "button",
        class: "sw-update-toast__action",
        "data-sw-update-action": "true",
      },
      t("sw.reload"),
    );

    const handleFallbackUpdate = (): void => {
      action.disabled = true;
      void updateServiceWorker(true).catch(() => {
        if (!destroyed) action.disabled = false;
      });
    };

    action.addEventListener("click", handleFallbackUpdate);
    updateHandler = handleFallbackUpdate;
    toast.append(message, action);
    parent.append(toast);
    updateToast = toast;
    updateAction = action;
  }

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: showUpdateAvailable,
    onOfflineReady: showOfflineReady,
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearOfflineReadyTimer();
      offlineReadyToast?.remove();
      if (updateAction !== null && updateHandler !== null) {
        updateAction.removeEventListener("click", updateHandler);
      }
      updateToast?.remove();
      offlineReadyToast = null;
      updateToast = null;
      updateAction = null;
      updateHandler = null;
    },
  };
}

/** Register the generated production worker; Vite resolves this virtual module at build time. */
export async function registerServiceWorker(
  parent: HTMLElement,
  toastController?: Pick<ToastController, "showToast" | "showActionToast">,
): Promise<ServiceWorkerUpdateController> {
  const { registerSW } = await import("virtual:pwa-register");
  return mountServiceWorkerUpdate(parent, registerSW, toastController);
}

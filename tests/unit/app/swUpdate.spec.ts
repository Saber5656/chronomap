import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mountServiceWorkerUpdate,
  type RegisterSWOptions,
  type RegisterServiceWorker,
  type UpdateServiceWorker,
} from "../../../src/app/swUpdate";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { mount as mountToast } from "../../../src/ui/components/Toast";

describe("service worker update boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows offline-ready once and removes the transient toast", () => {
    vi.useFakeTimers();
    const parent = document.createElement("div");
    let options: RegisterSWOptions | undefined;
    const registerSW: RegisterServiceWorker = (nextOptions) => {
      options = nextOptions;
      return () => Promise.resolve();
    };
    const controller = mountServiceWorkerUpdate(parent, registerSW);

    options?.onOfflineReady?.();
    options?.onOfflineReady?.();
    expect(parent.querySelectorAll("[data-sw-offline-ready]")).toHaveLength(1);

    vi.advanceTimersByTime(4_000);
    expect(parent.querySelector("[data-sw-offline-ready]")).toBeNull();

    controller.destroy();
  });

  it("keeps the update prompt until the user accepts and passes reload consent", async () => {
    const parent = document.createElement("div");
    let options: RegisterSWOptions | undefined;
    const updateServiceWorker = vi.fn<UpdateServiceWorker>(() => Promise.resolve());
    const registerSW: RegisterServiceWorker = (nextOptions) => {
      options = nextOptions;
      return updateServiceWorker;
    };
    const controller = mountServiceWorkerUpdate(parent, registerSW);

    options?.onNeedRefresh?.();
    options?.onNeedRefresh?.();
    const toast = parent.querySelector<HTMLElement>("[data-sw-update]");
    const action = parent.querySelector<HTMLButtonElement>("[data-sw-update-action]");

    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(toast?.textContent).toContain("新しいバージョンがあります");
    expect(action?.textContent).toBe("更新");
    expect(action?.disabled).toBe(false);

    action?.click();
    expect(updateServiceWorker).toHaveBeenCalledOnce();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(toast !== null && parent.contains(toast)).toBe(true);

    await Promise.resolve();
    controller.destroy();
  });

  it("re-presents the shared update prompt when the reload action fails", async () => {
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const toast = mountToast(parent, store);
    let options: RegisterSWOptions | undefined;
    const updateServiceWorker = vi.fn<UpdateServiceWorker>(() =>
      Promise.reject(new Error("update failed")),
    );
    const registerSW: RegisterServiceWorker = (nextOptions) => {
      options = nextOptions;
      return updateServiceWorker;
    };
    const controller = mountServiceWorkerUpdate(parent, registerSW, toast);

    options?.onNeedRefresh?.();
    expect(parent.querySelector(".toast__action")).not.toBeNull();
    parent.querySelector<HTMLButtonElement>(".toast__action")?.click();
    await Promise.resolve();

    expect(updateServiceWorker).toHaveBeenCalledOnce();
    expect(parent.querySelector(".toast__action")).not.toBeNull();

    controller.destroy();
    toast.destroy();
  });

  it("allows a later shared update notification after the prompt expires", () => {
    vi.useFakeTimers();
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const toast = mountToast(parent, store);
    let options: RegisterSWOptions | undefined;
    const registerSW: RegisterServiceWorker = (nextOptions) => {
      options = nextOptions;
      return () => Promise.resolve();
    };
    const controller = mountServiceWorkerUpdate(parent, registerSW, toast);

    options?.onNeedRefresh?.();
    vi.advanceTimersByTime(8_000);
    options?.onNeedRefresh?.();

    expect(parent.querySelectorAll(".toast__action")).toHaveLength(1);
    controller.destroy();
    toast.destroy();
  });
});

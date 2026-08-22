import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mountServiceWorkerUpdate,
  type RegisterSWOptions,
  type RegisterServiceWorker,
  type UpdateServiceWorker,
} from "../../../src/app/swUpdate";

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
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GeoError, type Fix } from "../../../src/map/geolocation";
import { mount } from "../../../src/ui/components/LocateButton";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

const FIX: Fix = {
  lat: 35.681236,
  lng: 139.767125,
  accuracyM: 35,
  at: 1_724_000_000_000,
};

function setup(
  options: {
    requestFix?: () => Promise<Fix>;
    mapController?: {
      flyToUser: (fix: Pick<Fix, "lat" | "lng">) => void;
      setUserFix?: (fix: Fix) => void;
    };
  } = {},
) {
  const parent = document.createElement("div");
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const handle = mount(parent, store, options);
  const button = parent.querySelector<HTMLButtonElement>("button.locate-button");
  if (button === null) throw new Error("Expected locate button.");
  return { parent, store, handle, button };
}

function flushPromises(): Promise<void> {
  return Promise.resolve();
}

describe("LocateButton", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  it("does not call the browser API until the user taps the button", async () => {
    let success: PositionCallback | undefined;
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((callback) => {
      success = callback;
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const mapController = {
      flyToUser: vi.fn(),
      setUserFix: vi.fn(),
    };
    const { store, handle, button } = setup({ mapController });

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(button.dataset.state).toBe("idle");
    expect(button.getAttribute("aria-pressed")).toBeNull();

    button.click();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(store.get().geo.status).toBe("requesting");

    success?.({
      coords: {
        latitude: FIX.lat,
        longitude: FIX.lng,
        accuracy: FIX.accuracyM,
      } as GeolocationCoordinates,
      timestamp: FIX.at,
    } as GeolocationPosition);
    await flushPromises();

    expect(store.get().geo).toEqual({ status: "granted", fix: FIX });
    expect(mapController.setUserFix).toHaveBeenCalledWith(FIX);
    expect(mapController.flyToUser).toHaveBeenCalledWith({
      lat: FIX.lat,
      lng: FIX.lng,
      accuracyM: FIX.accuracyM,
      at: FIX.at,
    });
    expect(button.dataset.state).toBe("granted");
    handle.destroy();
  });

  it("maps denial to the slashed state and opens settings guidance on the next tap", async () => {
    const requestFix = vi
      .fn<() => Promise<Fix>>()
      .mockRejectedValueOnce(new GeoError("denied"))
      .mockResolvedValueOnce(FIX);
    const { parent, store, handle, button } = setup({ requestFix });
    document.body.append(parent);

    button.click();
    await flushPromises();
    await flushPromises();

    expect(store.get().geo.status).toBe("denied");
    expect(button.dataset.state).toBe("denied");
    expect(parent.querySelector(".locate-popover")?.hasAttribute("hidden")).toBe(true);

    button.click();
    const popover = parent.querySelector<HTMLElement>(".locate-popover");
    const retryButton = parent.querySelector<HTMLButtonElement>(".locate-popover__retry");
    expect(popover?.hidden).toBe(false);
    expect(popover?.getAttribute("aria-modal")).toBe("true");
    expect(popover?.textContent).toContain("位置情報");
    expect(document.activeElement).toBe(retryButton);
    expect(requestFix).toHaveBeenCalledOnce();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(retryButton);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(popover?.hidden).toBe(true);

    button.click();
    expect(popover?.hidden).toBe(false);
    expect(requestFix).toHaveBeenCalledOnce();

    retryButton?.click();
    await flushPromises();
    await flushPromises();
    expect(requestFix).toHaveBeenCalledTimes(2);
    expect(store.get().geo.status).toBe("granted");
    expect(document.activeElement).toBe(button);
    handle.destroy();
  });

  it("returns focus to the locate button when the denied popover closes with Escape", async () => {
    const requestFix = vi.fn<() => Promise<Fix>>().mockRejectedValue(new GeoError("denied"));
    const { parent, handle, button } = setup({ requestFix });
    document.body.append(parent);

    button.click();
    await flushPromises();
    await flushPromises();
    button.click();
    const popover = parent.querySelector<HTMLElement>(".locate-popover");
    if (popover === null || popover.hidden) throw new Error("Expected the denied popover.");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(popover.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    handle.destroy();
  });

  it("returns to idle and shows the localized timeout toast", async () => {
    const requestFix = vi.fn<() => Promise<Fix>>().mockRejectedValue(new GeoError("timeout"));
    const { store, handle, button } = setup({ requestFix });

    button.click();
    await flushPromises();
    await flushPromises();

    expect(store.get().geo.status).toBe("idle");
    expect(store.get().ui.toast).toEqual({
      id: 1,
      kind: "error",
      text: "位置情報の取得がタイムアウトしました",
    });
    expect(button.disabled).toBe(false);
    handle.destroy();
  });

  it("hides the control when location is unavailable", () => {
    const { store, handle, parent } = setup();

    expect(store.get().geo.status).toBe("unavailable");
    expect(parent.querySelector<HTMLElement>(".locate-control")?.hidden).toBe(true);
    handle.destroy();
  });

  it("re-renders labels through the language boundary", () => {
    const requestFix = vi.fn<() => Promise<Fix>>();
    const { store, handle, button } = setup({ requestFix });

    expect(button.getAttribute("aria-label")).toBe("現在地を取得");
    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "en" } }));
    expect(button.getAttribute("aria-label")).toBe("Find my location");
    handle.destroy();
  });

  it("ignores a late fix after the control has been destroyed", async () => {
    let resolveFix: ((fix: Fix) => void) | undefined;
    const requestFix = vi.fn(
      () =>
        new Promise<Fix>((resolve) => {
          resolveFix = resolve;
        }),
    );
    const mapController = { flyToUser: vi.fn(), setUserFix: vi.fn() };
    const { store, handle, button } = setup({ requestFix, mapController });

    button.click();
    expect(store.get().geo.status).toBe("requesting");
    handle.destroy();
    resolveFix?.(FIX);
    await flushPromises();

    expect(store.get().geo).toEqual({ status: "requesting", fix: null });
    expect(mapController.setUserFix).not.toHaveBeenCalled();
    expect(mapController.flyToUser).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mount as mountShell } from "../../../src/app/appShell";
import {
  hasDeepLinkParams,
  mountOnboarding,
  ONBOARDING_STORAGE_KEY,
} from "../../../src/app/onboarding";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

function storage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

function setup(options: { includeLocate?: boolean; search?: string } = {}) {
  const parent = document.createElement("div");
  const shell = mountShell(parent, createStore({}));
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const slider = document.createElement("div");
  slider.className = "time-slider";
  const locate = document.createElement("button");
  locate.className = "locate-button";
  const menu = document.createElement("button");
  menu.className = "menu-trigger";
  shell.getSlot("TimeSlider").append(slider);
  if (options.includeLocate !== false) shell.getSlot("LocateButton").append(locate);
  shell.getSlot("MenuButton").append(menu);
  shell.getSlot("slider-dock").getBoundingClientRect = () => rect(0, 740, 390, 104);
  slider.getBoundingClientRect = () => rect(24, 770, 342, 44);
  locate.getBoundingClientRect = () => rect(334, 16, 44, 44);
  menu.getBoundingClientRect = () => rect(334, 128, 44, 44);
  document.body.append(parent);

  const savedStorage = storage();
  const controller = mountOnboarding(document.body, shell, store, {
    storage: savedStorage,
    basePath: "/",
    location: { pathname: "/", search: options.search ?? "" },
  });
  return { controller, locate, menu, parent, savedStorage, shell, slider, store };
}

describe("onboarding coach", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.stubGlobal("localStorage", storage());
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognizes only public deep-link parameters", () => {
    expect(hasDeepLinkParams("?lat=35&lng=139")).toBe(true);
    expect(hasDeepLinkParams("?year=1965")).toBe(true);
    expect(hasDeepLinkParams("?unknown=1")).toBe(false);
    expect(hasDeepLinkParams("")).toBe(false);
  });

  it("opens on the first available target with four scrim regions and focused Next", () => {
    const { controller, savedStorage, parent } = setup();
    const coach = document.querySelector<HTMLElement>(".onboarding-coach");
    const next = document.querySelector<HTMLButtonElement>("[data-onboarding-next]");

    expect(coach?.dataset.onboardingStep).toBe("1");
    expect(document.querySelectorAll("[data-onboarding-scrim]")).toHaveLength(4);
    expect(document.querySelector("[data-onboarding-progress]")?.textContent).toBe("1 / 3");
    expect(document.querySelector("[data-onboarding-skip]")?.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(next);
    expect(parent.querySelector(".onboarding-target")).not.toBeNull();
    expect(savedStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    controller.destroy();
  });

  it("navigates all steps, hides skip after step one, and persists completion", () => {
    const { controller, savedStorage } = setup();
    const next = (): HTMLButtonElement => {
      const button = document.querySelector<HTMLButtonElement>("[data-onboarding-next]");
      if (button === null) throw new Error("Expected onboarding next button.");
      return button;
    };

    next().click();
    expect(
      document.querySelector("[data-onboarding-step-id]")?.getAttribute("data-onboarding-step-id"),
    ).toBe("locate");
    expect(document.querySelector("[data-onboarding-skip]")?.hasAttribute("hidden")).toBe(true);
    next().click();
    expect(
      document.querySelector("[data-onboarding-step-id]")?.getAttribute("data-onboarding-step-id"),
    ).toBe("menu");
    next().click();

    expect(document.querySelector(".onboarding-coach")).toBeNull();
    expect(savedStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("1");
    controller.destroy();
  });

  it("skips on Escape or outside pointer input and marks deep links complete", () => {
    const first = setup();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(first.savedStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("1");
    expect(document.querySelector(".onboarding-coach")).toBeNull();
    first.controller.destroy();

    document.body.replaceChildren();
    const deepLink = setup({ search: "?lat=35.681236" });
    expect(document.querySelector(".onboarding-coach")).toBeNull();
    expect(deepLink.savedStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("1");
    deepLink.controller.destroy();
  });

  it("advances past a missing target instead of blocking first-run use", () => {
    const { controller } = setup({ includeLocate: false });
    expect(
      document.querySelector("[data-onboarding-step-id]")?.getAttribute("data-onboarding-step-id"),
    ).toBe("slider");
    document.querySelector<HTMLButtonElement>("[data-onboarding-next]")?.click();
    expect(
      document.querySelector("[data-onboarding-step-id]")?.getAttribute("data-onboarding-step-id"),
    ).toBe("menu");
    controller.destroy();
  });

  it("rerenders localized copy without changing the completion decision", () => {
    const { controller, savedStorage, store } = setup();
    expect(document.querySelector("[data-onboarding-message]")?.textContent).toBe(
      "スライダーで年代を移動",
    );
    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "en" } }));
    expect(document.querySelector("[data-onboarding-message]")?.textContent).toBe(
      "Move through time with the slider",
    );
    expect(savedStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    controller.destroy();
  });
});

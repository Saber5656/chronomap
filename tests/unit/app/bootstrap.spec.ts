import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMap: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("../../../src/map/mapController", () => ({
  createMap: mocks.createMap,
}));

import { bootstrap } from "../../../src/app/bootstrap";

function storage(): Storage {
  const values = new Map<string, string>();
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

function setNavigatorLanguage(language: string): void {
  Object.defineProperty(window.navigator, "language", { configurable: true, value: language });
}

describe("production bootstrap", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", storage());
    document.body.replaceChildren();
    document.documentElement.lang = "ja";
    setNavigatorLanguage("en-US");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes locale before the MenuButton slot renders", () => {
    const parent = document.createElement("div");
    const runtime = bootstrap(parent, new Date(2026, 0, 1));
    const button = runtime.shell
      .getSlot("MenuButton")
      .querySelector<HTMLButtonElement>("[data-menu-item='language']");

    expect(runtime.store.get().ui.lang).toBe("en");
    expect(localStorage.getItem("chronomap.lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(button?.textContent).toBe("日本語");
    expect(button?.getAttribute("aria-label")).toBe("日本語");

    runtime.destroy();
  });

  it("toggles the language through the DOM and restores it on the next bootstrap", () => {
    setNavigatorLanguage("ja-JP");
    const parent = document.createElement("div");
    const first = bootstrap(parent, new Date(2026, 0, 1));
    const firstButton = first.shell
      .getSlot("MenuButton")
      .querySelector<HTMLButtonElement>("[data-menu-item='language']");

    expect(firstButton?.textContent).toBe("English");
    firstButton?.click();

    expect(first.store.get().ui.lang).toBe("en");
    expect(localStorage.getItem("chronomap.lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(firstButton?.textContent).toBe("日本語");

    first.destroy();
    const second = bootstrap(parent, new Date(2026, 0, 1));
    const secondButton = second.shell
      .getSlot("MenuButton")
      .querySelector<HTMLButtonElement>("[data-menu-item='language']");

    expect(second.store.get().ui.lang).toBe("en");
    expect(secondButton?.textContent).toBe("日本語");
    second.destroy();
  });
});

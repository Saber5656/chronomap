import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { createLanguageToggleItem, mountMenuButton } from "../../../src/ui/components/MenuButton";
import { initI18n } from "../../../src/ui/i18n";

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

describe("MenuButton language item", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", storage());
    document.body.replaceChildren();
    document.documentElement.lang = "ja";
    setNavigatorLanguage("ja-JP");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders an accessible reusable item and toggles language state", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const item = createLanguageToggleItem(store);
    parent.append(item.element);

    expect(item.element.tagName).toBe("BUTTON");
    expect(item.element.getAttribute("type")).toBe("button");
    expect(item.element.getAttribute("aria-label")).toBe("English");
    expect(item.element.textContent).toBe("English");
    expect(item.element.dataset.menuItem).toBe("language");

    item.element.click();

    expect(store.get().ui.lang).toBe("en");
    expect(localStorage.getItem("chronomap.lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(item.element.getAttribute("aria-label")).toBe("日本語");
    expect(item.element.textContent).toBe("日本語");

    item.destroy();
    expect(parent.childElementCount).toBe(0);
    item.element.click();
    expect(store.get().ui.lang).toBe("en");
    i18n.destroy();
  });

  it("mounts and destroys the reusable item in the existing slot", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const controller = mountMenuButton(parent, store);

    expect(parent.querySelector("[data-menu-item='language']")).not.toBeNull();

    controller.destroy();
    expect(parent.childElementCount).toBe(0);
    i18n.destroy();
  });
});

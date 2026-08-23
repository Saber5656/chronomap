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
    document.body.append(parent);
    const controller = mountMenuButton(parent, store);

    expect(parent.querySelector("[data-menu-item='language']")).not.toBeNull();

    controller.destroy();
    expect(parent.childElementCount).toBe(0);
    i18n.destroy();
  });

  it("hides geo registration when the browser API is unavailable", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const controller = mountMenuButton(parent, store, { pageNavigator: {} });

    parent.querySelector<HTMLButtonElement>(".menu-trigger")?.click();

    expect(parent.querySelector("[data-menu-item='register-geo']")).toBeNull();
    controller.destroy();
    i18n.destroy();
  });

  it("registers geo links only after an explicit menu action", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const registerProtocolHandler = vi.fn();
    const controller = mountMenuButton(parent, store, {
      baseUrl: "/chronomap/",
      pageLocation: { origin: "https://example.test", search: "" },
      pageNavigator: { registerProtocolHandler },
    });
    const trigger = parent.querySelector<HTMLButtonElement>(".menu-trigger");
    const geoButton = parent.querySelector<HTMLButtonElement>("[data-menu-item='register-geo']");

    expect(registerProtocolHandler).not.toHaveBeenCalled();
    expect(geoButton).not.toBeNull();
    trigger?.click();
    geoButton?.click();

    expect(registerProtocolHandler).toHaveBeenCalledWith(
      "geo",
      "https://example.test/chronomap/share?text=%s",
      "chronomap",
    );
    expect(store.get().ui.toast).toMatchObject({
      kind: "info",
      text: "geo リンクをこのアプリで開く設定をブラウザへ要求しました。確認が表示されたら許可してください。",
    });

    controller.destroy();
    i18n.destroy();
  });

  it("shows an error toast when registration is rejected", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const registerProtocolHandler = vi.fn(() => {
      throw new Error("Not allowed");
    });
    const controller = mountMenuButton(parent, store, {
      pageNavigator: { registerProtocolHandler },
    });

    parent.querySelector<HTMLButtonElement>(".menu-trigger")?.click();
    parent.querySelector<HTMLButtonElement>("[data-menu-item='register-geo']")?.click();

    expect(store.get().ui.toast).toMatchObject({
      kind: "error",
      text: "geo リンクの登録に失敗しました。ブラウザの設定を確認してください。",
    });

    controller.destroy();
    i18n.destroy();
  });

  it("rejects a cross-origin geo handler URL", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const registerProtocolHandler = vi.fn();
    const controller = mountMenuButton(parent, store, {
      baseUrl: "https://evil.example/",
      pageLocation: { origin: "https://example.test", search: "" },
      pageNavigator: { registerProtocolHandler },
    });

    parent.querySelector<HTMLButtonElement>(".menu-trigger")?.click();
    parent.querySelector<HTMLButtonElement>("[data-menu-item='register-geo']")?.click();

    expect(registerProtocolHandler).not.toHaveBeenCalled();
    expect(store.get().ui.toast).toMatchObject({
      kind: "error",
      text: "geo リンクの登録に失敗しました。ブラウザの設定を確認してください。",
    });

    controller.destroy();
    i18n.destroy();
  });
  it("rejects credentials in a same-origin geo handler URL", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const registerProtocolHandler = vi.fn();
    const controller = mountMenuButton(parent, store, {
      baseUrl: "https://user:pass@example.test/chronomap/",
      pageLocation: { origin: "https://example.test", search: "" },
      pageNavigator: { registerProtocolHandler },
    });

    parent.querySelector<HTMLButtonElement>(".menu-trigger")?.click();
    parent.querySelector<HTMLButtonElement>("[data-menu-item='register-geo']")?.click();

    expect(registerProtocolHandler).not.toHaveBeenCalled();
    expect(store.get().ui.toast?.kind).toBe("error");

    controller.destroy();
    i18n.destroy();
  });

  it("opens the About sheet from the menu and restores trigger focus", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    document.body.append(parent);
    const controller = mountMenuButton(parent, store);
    const trigger = parent.querySelector<HTMLButtonElement>(".menu-trigger");
    const about = parent.querySelector<HTMLButtonElement>("[data-menu-item='about']");

    if (trigger === null || about === null) throw new Error("Expected menu About controls.");
    trigger.click();
    expect(about.textContent).toBe("このアプリについて");

    about.click();

    expect(store.get().ui.sheet).toBe("about");
    expect(document.activeElement).toBe(trigger);
    expect(parent.querySelector(".menu-popover")?.hasAttribute("hidden")).toBe(true);

    controller.destroy();
    i18n.destroy();
  });
});

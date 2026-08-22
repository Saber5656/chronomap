import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import {
  LANG_STORAGE_KEY,
  bindLanguageToggle,
  formatDistance,
  initI18n,
  onLangChange,
  t,
} from "../../../src/ui/i18n";

function store() {
  return createStore(createInitialState(new Date(2026, 0, 1)));
}

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

describe("i18n runtime", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", storage());
    localStorage.clear();
    setNavigatorLanguage("en-US");
    document.documentElement.lang = "ja";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects the browser locale and writes ui.lang and document.lang", () => {
    const appStore = store();
    const controller = initI18n(appStore);

    expect(appStore.get().ui.lang).toBe("en");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    controller.destroy();
  });

  it("prefers a valid persisted locale over navigator.language", () => {
    localStorage.setItem(LANG_STORAGE_KEY, "ja");
    setNavigatorLanguage("en-US");
    const appStore = store();
    const controller = initI18n(appStore);

    expect(appStore.get().ui.lang).toBe("ja");
    expect(t("menu.lang")).toBe("English");
    controller.destroy();
  });

  it("cycles and persists the language through the toggle binding", () => {
    const appStore = store();
    const controller = initI18n(appStore);
    const listener = vi.fn();
    const remove = onLangChange(appStore, listener);
    const toggle = bindLanguageToggle(appStore);

    expect(toggle.toggle()).toBe("ja");
    expect(toggle.getLocale()).toBe("ja");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    expect(listener).toHaveBeenCalledWith("ja", "en");

    remove();
    controller.destroy();
  });

  it("lets components subscribe to external language actions", () => {
    const appStore = store();
    const controller = initI18n(appStore);
    const listener = vi.fn();
    const remove = onLangChange(appStore, listener);

    createActions(appStore).setLang("ja");
    expect(listener).toHaveBeenCalledWith("ja", "en");
    expect(t("slider.valuetext", { year: 1965, layerTitle: "空中写真" })).toBe("1965年 — 空中写真");

    remove();
    controller.destroy();
  });

  it("provides interpolation and a dev-only missing-key fallback", () => {
    const controller = initI18n(store());
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(t("slider.valuetext", { year: 1965, layerTitle: "Aerial imagery" })).toBe(
      "1965 — Aerial imagery",
    );
    expect(t("slider.valuetext", { year: 1965 })).toBe("1965 — {layerTitle}");
    // @ts-expect-error t() must reject keys that are not present in the locale seed.
    expect(t("missing.key")).toBe("missing.key");
    expect(warning).toHaveBeenCalledWith("Missing i18n key: missing.key");

    warning.mockRestore();
    controller.destroy();
  });

  it("exposes a self-contained toggle binding for the future MenuButton", () => {
    const appStore = store();
    const toggle = bindLanguageToggle(appStore);

    toggle.setLocale("ja");
    expect(toggle.key).toBe("menu.lang");
    expect(toggle.getLabel()).toBe("English");
    expect(toggle.toggle()).toBe("en");
    expect(toggle.getLocale()).toBe("en");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(toggle.getLabel()).toBe("日本語");
  });

  it("caches distance number formatters per locale", () => {
    const RealNumberFormat = Intl.NumberFormat;
    let constructions = 0;
    class CountingNumberFormat {
      private readonly delegate: Intl.NumberFormat;

      constructor(locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions) {
        constructions += 1;
        this.delegate = new RealNumberFormat(locales, options);
      }

      format(value: number): string {
        return this.delegate.format(value);
      }

      formatToParts(value: number): Intl.NumberFormatPart[] {
        return this.delegate.formatToParts(value);
      }
    }
    vi.stubGlobal("Intl", { NumberFormat: CountingNumberFormat });

    formatDistance(1000, "ja");
    formatDistance(1500, "ja");
    formatDistance(1000, "en");
    formatDistance(1500, "en");

    expect(constructions).toBe(2);
  });

  it("formats meters below one kilometer and rounded kilometers", () => {
    expect(formatDistance(999, "ja")).toBe("999 m");
    expect(formatDistance(1000, "ja")).toBe("1.0 km");
    expect(formatDistance(1500, "en")).toBe("1.5 km");
    expect(formatDistance(12345, "en")).toBe("12 km");
  });
});

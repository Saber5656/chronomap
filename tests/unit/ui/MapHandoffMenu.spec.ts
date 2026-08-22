import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { showMapHandoffMenu } from "../../../src/ui/components/MapHandoffMenu";
import { initI18n, t } from "../../../src/ui/i18n";

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

function setNavigatorUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

function setNavigatorLanguage(language: string): void {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: language,
  });
}

describe("MapHandoffMenu", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", storage());
    document.body.replaceChildren();
    document.documentElement.lang = "ja";
    setNavigatorLanguage("ja-JP");
    setNavigatorUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders ordered hardcoded actions and opens the exact selected URL", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const open = vi.spyOn(window, "open").mockReturnValue(window);
    const parent = document.createElement("div");
    document.body.append(parent);

    const controller = showMapHandoffMenu(35.681236, 139.767125, { parent, store, zoom: 15 });
    const buttons = [...parent.querySelectorAll<HTMLButtonElement>("[data-handoff-target]")];

    expect(buttons.map((button) => button.dataset.handoffTarget)).toEqual([
      "google",
      "apple",
      "geo",
    ]);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Google マップで開く…",
      "Apple マップで開く…",
      "地図アプリで開く…",
    ]);

    buttons[0]?.click();

    expect(open).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/?api=1&query=35.681236%2C139.767125",
      "_blank",
      "noopener,noreferrer",
    );
    expect(parent.querySelector("[data-handoff-target]")).toBeNull();

    controller.destroy();
    i18n.destroy();
  });

  it("copies the generated URL and shows a toast when the popup is blocked", async () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });
    vi.spyOn(window, "open").mockReturnValue(null);
    const parent = document.createElement("div");
    document.body.append(parent);

    showMapHandoffMenu(35.681236, 139.767125, { parent, store });
    parent.querySelector<HTMLButtonElement>("[data-handoff-target='google']")?.click();

    await vi.waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith(
        "https://www.google.com/maps/search/?api=1&query=35.681236%2C139.767125",
      );
    });
    expect(store.get().ui.toast?.text).toBe(t("handoff.popupBlocked", {}, "ja"));

    i18n.destroy();
  });

  it("omits geo on iOS", () => {
    setNavigatorUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    document.body.append(parent);

    const controller = showMapHandoffMenu(35, 139, { parent, store });

    expect(parent.querySelector("[data-handoff-target='geo']")).toBeNull();
    expect(parent.querySelectorAll("[data-handoff-target]")).toHaveLength(2);

    controller.destroy();
    i18n.destroy();
  });
});

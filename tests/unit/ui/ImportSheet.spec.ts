import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import type { ParseResult } from "../../../src/integrations/parseSharedLocation";
import { mount, shouldSubmitImportKey } from "../../../src/ui/components/ImportSheet";
import { initI18n } from "../../../src/ui/i18n";

function setup(options?: Parameters<typeof mount>[2]) {
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const i18n = initI18n(store);
  const parent = document.createElement("div");
  document.body.append(parent);
  const controller = mount(parent, store, options);
  return { controller, i18n, parent, store };
}

describe("ImportSheet", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "ja-JP",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("starts with an empty input and no guidance block", () => {
    const { controller, i18n, parent } = setup();
    const input = parent.querySelector<HTMLTextAreaElement>("textarea");
    const guidance = parent.querySelector<HTMLElement>("[role='alert']");

    expect(input?.value).toBe("");
    expect(guidance?.hidden).toBe(true);
    controller.destroy();
    i18n.destroy();
  });

  it("renders request prefill and preserves it after a parse failure", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    store.set((state) => ({
      ...state,
      ui: {
        ...state.ui,
        sheet: "import",
        importRequest: {
          prefill: "https://maps.app.goo.gl/example",
          reason: "shortlink",
          autofocus: false,
        },
      },
    }));
    const i18n = initI18n(store);
    const parent = document.createElement("div");
    const controller = mount(parent, store);
    const input = parent.querySelector<HTMLTextAreaElement>("textarea");
    const form = parent.querySelector<HTMLFormElement>("form");
    const guidance = parent.querySelector<HTMLElement>("[role='alert']");

    expect(input?.value).toBe("https://maps.app.goo.gl/example");
    expect(guidance?.textContent).toContain("短縮リンク");

    if (input === null || form === null) throw new Error("Expected import controls.");
    input.value = "not a location";
    form.requestSubmit();
    expect(input.value).toBe("not a location");
    expect(guidance?.hidden).toBe(false);

    controller.destroy();
    i18n.destroy();
  });

  it("opens a parsed location at the parsed/default zoom and reports success", () => {
    const onLocationOpened = vi.fn();
    const { controller, i18n, parent, store } = setup({ onLocationOpened });
    const input = parent.querySelector<HTMLTextAreaElement>("textarea");
    const button = parent.querySelector<HTMLButtonElement>("[data-import-action='open']");
    if (input === null || button === null) throw new Error("Expected import controls.");

    input.value = "geo:35.681236,139.767125";
    button.click();

    expect(store.get().ui.sheet).toBe("none");
    expect(store.get().view).toEqual({ lat: 35.681236, lng: 139.767125, zoom: 16 });
    expect(store.get().ui.toast?.text).toBe("場所を開きました");
    expect(onLocationOpened).toHaveBeenCalledWith({
      ok: true,
      lat: 35.681236,
      lng: 139.767125,
      source: "geo",
    });
    controller.destroy();
    i18n.destroy();
  });

  it.each([
    ["shortlink", "短縮リンク"],
    ["no-coords", "使える座標"],
    ["invalid", "入力を確認"],
  ] as const)("renders guidance for a mocked %s parse failure", (reason, guidanceText) => {
    const parseLocation = vi.fn<() => ParseResult>().mockReturnValue({ ok: false, reason });
    const { controller, i18n, parent } = setup({ parseLocation });
    const input = parent.querySelector<HTMLTextAreaElement>("textarea");
    const form = parent.querySelector<HTMLFormElement>("form");
    const guidance = parent.querySelector<HTMLElement>("[role='alert']");
    if (input === null || form === null || guidance === null) {
      throw new Error("Expected import controls.");
    }

    input.value = "preserve this input";
    form.requestSubmit();

    expect(parseLocation).toHaveBeenCalledWith("preserve this input");
    expect(input.value).toBe("preserve this input");
    expect(guidance.hidden).toBe(false);
    expect(guidance.textContent).toContain(guidanceText);
    controller.destroy();
    i18n.destroy();
  });

  it("uses the clipboard when available and silently falls back on permission failure", async () => {
    const readText = vi.fn().mockResolvedValue("35.68, 139.76");
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });
    const first = setup();
    const paste = first.parent.querySelector<HTMLButtonElement>("[data-import-action='paste']");
    paste?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(first.parent.querySelector("textarea")?.value).toBe("35.68, 139.76");
    first.controller.destroy();
    first.i18n.destroy();

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const second = setup();
    const secondPaste = second.parent.querySelector<HTMLButtonElement>(
      "[data-import-action='paste']",
    );
    expect(secondPaste?.hidden).toBe(false);
    secondPaste?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(second.parent.querySelector<HTMLElement>("[role='alert']")?.hidden).toBe(true);
    second.controller.destroy();
    second.i18n.destroy();
  });

  it("does not submit while IME is composing, but submits a normal Enter", () => {
    expect(
      shouldSubmitImportKey({ key: "Enter", shiftKey: false, isComposing: true, keyCode: 229 }),
    ).toBe(false);
    expect(
      shouldSubmitImportKey({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 }),
    ).toBe(true);
    expect(
      shouldSubmitImportKey({ key: "Enter", shiftKey: true, isComposing: false, keyCode: 13 }),
    ).toBe(false);
  });
});

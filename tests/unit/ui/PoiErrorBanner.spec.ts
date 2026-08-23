import { describe, expect, it, vi } from "vitest";

import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { mount } from "../../../src/ui/components/PoiErrorBanner";

describe("PoiErrorBanner", () => {
  it("shows a localized retry pill only while POI loading has failed", () => {
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const retry = vi.fn();
    const controller = mount(parent, store, retry);
    const root = parent.querySelector<HTMLElement>(".poi-error-banner");

    expect(root?.hidden).toBe(true);
    actions.setPoiStatus("error");
    expect(root?.hidden).toBe(false);
    expect(root?.getAttribute("role")).toBe("alert");
    expect(root?.textContent).toContain("記事を取得できませんでした");

    root?.querySelector<HTMLButtonElement>("button")?.click();
    expect(retry).toHaveBeenCalledOnce();

    actions.setLang("en");
    expect(root?.textContent).toContain("The articles could not be loaded");
    actions.setPoiStatus("ready");
    expect(root?.hidden).toBe(true);

    controller.destroy();
  });
});

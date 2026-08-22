import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../../../src/state/appState";
import { createStore } from "../../../../src/state/store";
import {
  buildShareUrl,
  mountMenuButton,
  shareCurrentView,
} from "../../../../src/ui/components/MenuButton";
import { mount as mountToast } from "../../../../src/ui/components/Toast";

const NOW = new Date(2026, 0, 1);
const LOCATION = { origin: "https://example.test", search: "" } as const;
const SERIALIZED = "?lat=34.7025&lng=135.4959&z=16&year=1965";

function createTestStore() {
  return createStore(createInitialState(NOW));
}

describe("MenuButton", () => {
  let parent: HTMLDivElement;

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.append(parent);
  });

  afterEach(() => {
    parent.remove();
  });

  it("builds normalized absolute URLs for project and relative bases", () => {
    expect(buildShareUrl(SERIALIZED, LOCATION, "/chronomap/")).toBe(
      "https://example.test/chronomap/?lat=34.7025&lng=135.4959&z=16&year=1965",
    );
    expect(buildShareUrl(SERIALIZED, LOCATION, "./")).toBe(
      "https://example.test/?lat=34.7025&lng=135.4959&z=16&year=1965",
    );
  });

  it("prefers Web Share API and passes the exact title and URL", async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    await expect(shareCurrentView(SERIALIZED, LOCATION, { share }, "/chronomap/")).resolves.toBe(
      "shared",
    );
    expect(share).toHaveBeenCalledWith({
      title: "chronomap",
      url: "https://example.test/chronomap/?lat=34.7025&lng=135.4959&z=16&year=1965",
    });
  });

  it("falls back to clipboard when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareCurrentView(SERIALIZED, LOCATION, { clipboard: { writeText } }, "/chronomap/"),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "https://example.test/chronomap/?lat=34.7025&lng=135.4959&z=16&year=1965",
    );
  });

  it("reports unavailable when neither sharing capability exists", async () => {
    await expect(shareCurrentView(SERIALIZED, LOCATION, {}, "/chronomap/")).resolves.toBe(
      "unavailable",
    );
  });

  it("opens an accessible popover, closes on Escape/outside tap, and updates locale", () => {
    const store = createTestStore();
    const menu = mountMenuButton(parent, store, {
      pageLocation: LOCATION,
      pageNavigator: {},
      getSerialized: () => SERIALIZED,
    });
    const trigger = parent.querySelector<HTMLButtonElement>(".menu-trigger");
    const popover = parent.querySelector<HTMLElement>("[role='menu']");
    const item = parent.querySelector<HTMLElement>("[role='menuitem']");

    expect(trigger?.getAttribute("aria-label")).toBe("メニュー");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(item?.textContent).toBe("この表示を共有");
    expect(popover?.hidden).toBe(true);

    trigger?.click();
    expect(popover?.hidden).toBe(false);
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(popover?.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger?.click();
    document.dispatchEvent(new Event("pointerdown"));
    expect(popover?.hidden).toBe(true);

    store.set((state) => ({ ...state, ui: { ...state.ui, lang: "en" } }));
    expect(trigger?.getAttribute("aria-label")).toBe("Menu");
    expect(item?.textContent).toBe("Share this view");

    menu.destroy();
    expect(parent.querySelector(".menu-button")).toBeNull();
  });

  it("copies the view and renders the translated toast", async () => {
    const store = createTestStore();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const menu = mountMenuButton(parent, store, {
      pageLocation: LOCATION,
      pageNavigator: { clipboard: { writeText } },
      baseUrl: "/chronomap/",
      getSerialized: () => SERIALIZED,
    });
    const toastHost = document.createElement("div");
    parent.append(toastHost);
    const toast = mountToast(toastHost, store);
    const trigger = parent.querySelector<HTMLButtonElement>(".menu-trigger");
    const item = parent.querySelector<HTMLButtonElement>("[role='menuitem']");

    trigger?.click();
    item?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(
      "https://example.test/chronomap/?lat=34.7025&lng=135.4959&z=16&year=1965",
    );
    const renderedToast = toastHost.querySelector<HTMLElement>(".toast");
    expect(renderedToast?.hidden).toBe(false);
    expect(renderedToast?.textContent).toBe("リンクをコピーしました");

    toast.destroy();
    menu.destroy();
  });
});

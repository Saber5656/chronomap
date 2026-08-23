import { afterEach, describe, expect, it, vi } from "vitest";

import type { Poi, PoiDetail } from "../../../src/providers/poi/types";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { mount } from "../../../src/ui/components/PoiSheet";
import { initI18n } from "../../../src/ui/i18n";

const selectedPoi: Poi = {
  id: "wikipedia-ja:1",
  title: "大阪城",
  lat: 34.6873,
  lng: 135.5262,
  distanceM: 1250,
  source: {
    provider: "wikipedia",
    lang: "ja",
    url: "https://ja.wikipedia.org/wiki/大阪城",
  },
};

const detail: PoiDetail = {
  extract: "安全な本文\n<script>はテキストです。</script>",
  thumbnailUrl: "https://upload.wikimedia.org/example.png",
  pageUrl: "https://ja.wikipedia.org/wiki/大阪城",
  attributionKey: "wikipedia-ccbysa",
};

type FetchDetail = (poi: Poi, options: { signal: AbortSignal }) => Promise<PoiDetail>;

function setup(fetchDetail: FetchDetail) {
  const parent = document.createElement("div");
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const actions = createActions(store);
  const i18n = initI18n(store);
  const controller = mount(parent, store, { fetchDetail });
  actions.setPoiItems([selectedPoi]);
  actions.selectPoi(selectedPoi.id);
  return { actions, controller, i18n, parent, store };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("PoiSheet", () => {
  it("renders the title and skeleton immediately, then safely fills the detail", async () => {
    let resolveDetail: ((value: PoiDetail) => void) | undefined;
    const fetchDetail = vi.fn(
      () =>
        new Promise<PoiDetail>((resolve) => {
          resolveDetail = resolve;
        }),
    );
    const { controller, i18n, parent } = setup(fetchDetail);

    expect(parent.querySelector(".poi-sheet__name")?.textContent).toBe("大阪城");
    expect(parent.querySelector(".poi-sheet__skeleton")).not.toBeNull();
    expect(fetchDetail).toHaveBeenCalledOnce();

    resolveDetail?.(detail);
    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__extract")).not.toBeNull());

    expect(parent.querySelector(".poi-sheet__extract")?.textContent).toBe(detail.extract);
    expect(parent.querySelector(".poi-sheet__extract")?.querySelector("script")).toBeNull();
    expect(parent.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(parent.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(parent.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(parent.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(parent.querySelector("[data-poi-action='open-in-maps']")?.hasAttribute("disabled")).toBe(
      false,
    );
    parent.querySelector("img")?.dispatchEvent(new Event("error"));
    expect(parent.querySelector<HTMLElement>(".poi-sheet__thumbnail")?.hidden).toBe(true);

    controller.destroy();
    i18n.destroy();
  });

  it("reserves thumbnail space while loading and hides it when the detail has no image", async () => {
    const fetchDetail = vi.fn().mockResolvedValue({ ...detail, thumbnailUrl: undefined });
    const { controller, i18n, parent } = setup(fetchDetail);

    expect(parent.querySelector(".poi-sheet__thumbnail--placeholder")).not.toBeNull();
    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__extract")).not.toBeNull());
    expect(parent.querySelector<HTMLElement>(".poi-sheet__thumbnail")?.hidden).toBe(true);

    controller.destroy();
    i18n.destroy();
  });

  it("focuses the sheet root before detail actions exist", () => {
    const fetchDetail = vi.fn(() => new Promise<PoiDetail>(() => undefined));
    const { controller, i18n, parent } = setup(fetchDetail);
    document.body.append(parent);

    controller.focus?.();
    expect(document.activeElement).toBe(parent.querySelector(".poi-sheet"));

    controller.destroy();
    i18n.destroy();
  });

  it("aborts stale selection requests and keeps only the latest result", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(value: PoiDetail) => void> = [];
    const fetchDetail = vi.fn((_poi: Poi, options: { signal: AbortSignal }) => {
      signals.push(options.signal);
      return new Promise<PoiDetail>((resolve) => resolvers.push(resolve));
    });
    const { actions, controller, i18n, parent } = setup(fetchDetail);
    const secondPoi = { ...selectedPoi, id: "wikipedia-ja:2", title: "通天閣" };
    actions.setPoiItems([selectedPoi, secondPoi]);
    actions.selectPoi(secondPoi.id);

    expect(signals[0]?.aborted).toBe(true);
    resolvers[0]?.(detail);
    resolvers[1]?.({ ...detail, extract: "最新の本文", pageUrl: secondPoi.source.url });
    await vi.waitFor(() =>
      expect(parent.querySelector(".poi-sheet__name")?.textContent).toBe("通天閣"),
    );
    expect(parent.querySelector(".poi-sheet__extract")?.textContent).toBe("最新の本文");

    actions.selectPoi(null);
    expect(parent.querySelector(".poi-sheet")?.childElementCount).toBe(0);
    controller.destroy();
    i18n.destroy();
  });

  it("shows a retry action after a detail failure", async () => {
    const fetchDetail = vi
      .fn<FetchDetail>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(detail);
    const { controller, i18n, parent } = setup(fetchDetail);

    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__retry")).not.toBeNull());
    parent.querySelector<HTMLButtonElement>(".poi-sheet__retry")?.click();
    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__extract")).not.toBeNull());
    expect(fetchDetail).toHaveBeenCalledTimes(2);

    controller.destroy();
    i18n.destroy();
  });
});

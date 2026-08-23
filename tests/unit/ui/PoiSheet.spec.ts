import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommonsImage, CommonsPhotoProvider } from "../../../src/providers/poi/commonsImages";
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

function photoProvider(images: readonly CommonsImage[]): CommonsPhotoProvider {
  return { fetch: vi.fn().mockResolvedValue(images) };
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

  it("aborts stale Commons photo requests and renders only the latest response", async () => {
    const photoRequests: Array<{
      readonly signal: AbortSignal;
      readonly resolve: (images: readonly CommonsImage[]) => void;
    }> = [];
    const photoProvider: CommonsPhotoProvider = {
      fetch(_poi, options = {}) {
        if (options.signal === undefined) throw new Error("Expected a Commons request signal.");
        return new Promise<readonly CommonsImage[]>((resolve) => {
          photoRequests.push({ signal: options.signal!, resolve });
        });
      },
    };
    const firstImage: CommonsImage = {
      id: "commons:first",
      title: "File:First.jpg",
      thumbUrl: "https://upload.wikimedia.org/commons/thumb/first.jpg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:First.jpg",
      year: 1900,
    };
    const secondImage: CommonsImage = {
      id: "commons:second",
      title: "File:Second.jpg",
      thumbUrl: "https://upload.wikimedia.org/commons/thumb/second.jpg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Second.jpg",
      year: 1910,
    };
    const fetchDetail = vi.fn().mockResolvedValue(detail);
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const i18n = initI18n(store);
    const controller = mount(parent, store, { fetchDetail, photoProvider });
    const secondPoi = { ...selectedPoi, id: "wikipedia-ja:2", title: "通天閣" };
    actions.setPoiItems([selectedPoi, secondPoi]);
    actions.selectPoi(selectedPoi.id);

    await vi.waitFor(() => expect(photoRequests).toHaveLength(1));
    actions.selectPoi(secondPoi.id);
    await vi.waitFor(() => expect(photoRequests).toHaveLength(2));
    expect(photoRequests[0]?.signal.aborted).toBe(true);

    photoRequests[0]?.resolve([firstImage]);
    photoRequests[1]?.resolve([secondImage]);
    await vi.waitFor(() =>
      expect(parent.querySelector(".poi-sheet__photo-year")?.textContent).toBe("1910"),
    );
    expect(parent.querySelectorAll(".poi-sheet__photo-year")).toHaveLength(1);

    actions.selectPoi(null);
    expect(photoRequests[1]?.signal.aborted).toBe(true);
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

  it("renders the best-effort Commons strip below the extract", async () => {
    const image: CommonsImage = {
      id: "commons:987654",
      title: "File:Osaka Castle sample.jpg",
      thumbUrl: "https://upload.wikimedia.org/commons/thumb/old.jpg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Osaka_Castle_sample.jpg",
      year: 1900,
    };
    const fetchDetail = vi.fn().mockResolvedValue(detail);
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const i18n = initI18n(store);
    actions.setLang("ja");
    const controller = mount(parent, store, {
      fetchDetail,
      photoProvider: photoProvider([image]),
    });
    actions.setPoiItems([selectedPoi]);
    actions.selectPoi(selectedPoi.id);

    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__photos")).not.toBeNull());
    const strip = parent.querySelector<HTMLElement>(".poi-sheet__photos");
    expect(strip?.querySelector(".poi-sheet__extract")).toBeNull();
    expect(strip?.querySelector(".poi-sheet__photos-title")?.textContent).toContain("古い写真");
    expect(strip?.querySelector(".poi-sheet__photo-year")?.textContent).toBe("1900");
    expect(strip?.querySelector(".poi-sheet__photos-credit")?.textContent).toContain(
      "Wikimedia Commons",
    );
    expect(strip?.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(strip?.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(strip?.previousElementSibling?.classList.contains("poi-sheet__body")).toBe(true);

    controller.destroy();
    i18n.destroy();
  });

  it("keeps the core sheet when the Commons provider fails", async () => {
    const fetchDetail = vi.fn().mockResolvedValue(detail);
    const provider: CommonsPhotoProvider = {
      fetch: vi.fn().mockRejectedValue(new Error("temporary Commons failure")),
    };
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const i18n = initI18n(store);
    const controller = mount(parent, store, { fetchDetail, photoProvider: provider });
    actions.setPoiItems([selectedPoi]);
    actions.selectPoi(selectedPoi.id);

    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__extract")).not.toBeNull());
    await Promise.resolve();
    expect(parent.querySelector(".poi-sheet__photos")).toBeNull();
    expect(parent.querySelector(".poi-sheet__extract")?.textContent).toBe(detail.extract);

    controller.destroy();
    i18n.destroy();
  });

  it("hides the whole Commons strip when one thumbnail fails", async () => {
    const images: CommonsImage[] = [
      {
        id: "commons:1",
        title: "File:First.jpg",
        thumbUrl: "https://upload.wikimedia.org/commons/thumb/first.jpg",
        pageUrl: "https://commons.wikimedia.org/wiki/File:First.jpg",
        year: 1900,
      },
      {
        id: "commons:2",
        title: "File:Second.jpg",
        thumbUrl: "https://upload.wikimedia.org/commons/thumb/second.jpg",
        pageUrl: "https://commons.wikimedia.org/wiki/File:Second.jpg",
        year: 1910,
      },
    ];
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const i18n = initI18n(store);
    const controller = mount(parent, store, {
      fetchDetail: vi.fn().mockResolvedValue(detail),
      photoProvider: photoProvider(images),
    });
    actions.setPoiItems([selectedPoi]);
    actions.selectPoi(selectedPoi.id);

    await vi.waitFor(() => expect(parent.querySelector(".poi-sheet__photos")).not.toBeNull());
    const strip = parent.querySelector<HTMLElement>(".poi-sheet__photos");
    const firstThumbnail = strip?.querySelector("img");
    if (firstThumbnail === null || firstThumbnail === undefined) {
      throw new Error("Expected the first Commons thumbnail.");
    }
    firstThumbnail.dispatchEvent(new Event("error"));
    expect(strip?.hidden).toBe(true);

    controller.destroy();
    i18n.destroy();
  });
});

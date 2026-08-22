import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  eraJumpYear,
  keyboardYear,
  mountTimeSlider,
  positionToYear,
  yearToPosition,
  TIME_SLIDER_SETTLE_DEBOUNCE_MS,
} from "../../../src/ui/components/TimeSlider";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import type { EraTick, LayerEntry } from "../../../src/providers/layers/types";

const TICKS: EraTick[] = [
  { layerId: "era-old", from: 1930, to: 1935 },
  { layerId: "era-mid", from: 1960, to: 1969 },
  { layerId: "era-recent", from: 2000, to: 2026 },
];

function layer(tick: EraTick): LayerEntry {
  return {
    id: tick.layerId,
    type: "raster-era",
    provider: "test",
    title: { ja: `${tick.from}年画像`, en: `${tick.from} imagery` },
    era: { from: tick.from, to: tick.to },
    region: "JP",
    coverage: [[139, 35, 140, 36]],
    tiles: {
      urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/test/{z}/{x}/{y}.png",
      scheme: "xyz",
      minzoom: 0,
      maxzoom: 22,
      tileSize: 256,
    },
    attribution: { text: "test", license: { name: "test" } },
    flags: { experimental: false, requiresFeatureFlag: null },
    priority: 0,
  };
}

function pointerEvent(type: string, values: { clientX: number; pointerId?: number }): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: values.clientX },
    pointerId: { value: values.pointerId ?? 1 },
    pointerType: { value: "touch" },
    button: { value: 0 },
    isPrimary: { value: true },
  });
  return event;
}

function trackBounds(): DOMRect {
  return {
    bottom: 28,
    height: 28,
    left: 100,
    right: 500,
    top: 0,
    width: 400,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  };
}

describe("TimeSlider helpers", () => {
  it("maps years and track positions with clamping and rounding", () => {
    expect(yearToPosition(1890, 1890, 2026, 400)).toBe(0);
    expect(yearToPosition(1958, 1890, 2026, 400)).toBe(200);
    expect(yearToPosition(1800, 1890, 2026, 400)).toBe(0);
    expect(positionToYear(200, 1890, 2026, 400)).toBe(1958);
    expect(positionToYear(999, 1890, 2026, 400)).toBe(2026);
  });

  it("jumps through distinct era starts for page keys", () => {
    expect(eraJumpYear(1932, "next", TICKS, 1890, 2026)).toBe(1960);
    expect(eraJumpYear(1965, "previous", TICKS, 1890, 2026)).toBe(1960);
    expect(keyboardYear(1950, "ArrowRight", TICKS, 1890, 2026)).toBe(1951);
    expect(keyboardYear(1950, "ArrowRight", TICKS, 1890, 2026, true)).toBe(1960);
    expect(keyboardYear(1950, "PageUp", TICKS, 1890, 2026)).toBe(1960);
    expect(keyboardYear(1950, "PageDown", TICKS, 1890, 2026)).toBe(1930);
    expect(keyboardYear(1950, "Escape", TICKS, 1890, 2026)).toBeNull();
  });
});

describe("TimeSlider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  function setup() {
    const initial = createInitialState(new Date(2026, 0, 1));
    initial.view = { lat: 35.5, lng: 139.5, zoom: 14 };
    initial.year = 1950;
    initial.timeLayer = {
      activeLayerId: "era-mid",
      opacity: 1,
      disabled: false,
      resolution: { candidates: ["era-mid"], reason: "ok", snapped: false },
    };
    const store = createStore(initial);
    const parent = document.createElement("div");
    document.body.append(parent);
    const controller = mountTimeSlider(parent, store, {
      currentYear: 2026,
      now: new Date(2026, 0, 1),
      registry: TICKS.map(layer),
    });
    const root = parent.querySelector<HTMLElement>("[role='slider']");
    const track = parent.querySelector<HTMLElement>(".time-slider__track");
    if (root === null || track === null) throw new Error("Expected mounted slider.");
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue(trackBounds());
    window.dispatchEvent(new Event("resize"));
    return { controller, parent, root, store, track };
  }

  it("renders ARIA state and dims unavailable era segments", () => {
    const { controller, parent, root, store } = setup();

    expect(root.getAttribute("aria-orientation")).toBe("horizontal");
    expect(root.getAttribute("aria-valuemin")).toBe("1890");
    expect(root.getAttribute("aria-valuemax")).toBe("2026");
    expect(root.getAttribute("aria-valuenow")).toBe("1950");
    expect(root.getAttribute("aria-valuetext")).toBe("1950年 — 1960年画像");
    expect(parent.querySelectorAll(".time-slider__era-segment")).toHaveLength(3);
    expect(parent.querySelector<HTMLElement>("[data-layer-id='era-old']")?.style.opacity).toBe(
      "0.35",
    );
    expect(parent.querySelector<HTMLElement>("[data-layer-id='era-mid']")?.style.opacity).toBe("1");

    createActions(store).setYear(1965);
    expect(root.getAttribute("aria-valuenow")).toBe("1965");
    expect(parent.querySelector<HTMLElement>(".time-slider__value")?.textContent).toBe("1965年");

    controller.destroy();
  });

  it("updates year live and commits after the 150 ms settle debounce", () => {
    const { controller, root, store } = setup();
    const changes: number[] = [];
    root.addEventListener("yearchange", (event) => {
      changes.push((event as CustomEvent<{ year: number }>).detail.year);
    });

    root.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    expect(root.getAttribute("aria-valuenow")).toBe("1958");
    expect(store.get().year).toBe(1950);
    vi.advanceTimersByTime(TIME_SLIDER_SETTLE_DEBOUNCE_MS - 1);
    expect(store.get().year).toBe(1950);
    vi.advanceTimersByTime(1);
    expect(store.get().year).toBe(1958);
    expect(changes).toEqual([1958]);

    root.dispatchEvent(pointerEvent("pointerup", { clientX: 300 }));
    controller.destroy();
  });

  it("commits supported keyboard movements immediately", () => {
    const { controller, root, store } = setup();

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(store.get().year).toBe(1890);
    root.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }),
    );
    expect(store.get().year).toBe(1900);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", bubbles: true }));
    expect(store.get().year).toBe(1930);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(store.get().year).toBe(2026);

    controller.destroy();
  });

  it("uses the no-data ARIA value when resolution has no coverage", () => {
    const { controller, root, store } = setup();
    createActions(store).setActiveLayer(null, {
      candidates: [],
      reason: "no-coverage",
      snapped: false,
    });
    expect(root.getAttribute("aria-valuetext")).toBe("データなし");
    controller.destroy();
  });

  it("honors the registry disabled flag for pointer and keyboard input", () => {
    const { controller, root, store } = setup();
    const actions = createActions(store);

    actions.setActiveLayer(null, {
      candidates: [],
      reason: "registry-empty",
      snapped: false,
    });
    expect(root.getAttribute("aria-disabled")).toBe("true");
    expect(root.getAttribute("tabindex")).toBe("-1");

    root.dispatchEvent(pointerEvent("pointerdown", { clientX: 300 }));
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(store.get().year).toBe(1950);

    actions.setActiveLayer("era-mid", {
      candidates: ["era-mid"],
      reason: "ok",
      snapped: false,
    });
    expect(root.getAttribute("aria-disabled")).toBe("false");
    controller.destroy();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cycleOpacityPercent,
  exceedsOpacityLongPressMoveThreshold,
  hasOpacityLongPressElapsed,
  mountOpacityControl,
  OPACITY_LONG_PRESS_MS,
  OPACITY_SLIDER_STEP_PERCENT,
} from "../../../src/ui/components/OpacityControl";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

function pointerEvent(
  type: string,
  values: { clientX?: number; clientY?: number; pointerId?: number } = {},
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: values.clientX ?? 0 },
    clientY: { value: values.clientY ?? 0 },
    pointerId: { value: values.pointerId ?? 1 },
    pointerType: { value: "touch" },
    button: { value: 0 },
    isPrimary: { value: true },
  });
  return event;
}

describe("OpacityControl helpers", () => {
  it("cycles the documented compact presets and returns fine values to full opacity", () => {
    expect(cycleOpacityPercent(100)).toBe(60);
    expect(cycleOpacityPercent(60)).toBe(0);
    expect(cycleOpacityPercent(0)).toBe(100);
    expect(cycleOpacityPercent(25)).toBe(100);
  });

  it("recognizes the exact long-press threshold and movement cancellation boundary", () => {
    expect(hasOpacityLongPressElapsed(1_000, 1_000 + OPACITY_LONG_PRESS_MS - 1)).toBe(false);
    expect(hasOpacityLongPressElapsed(1_000, 1_000 + OPACITY_LONG_PRESS_MS)).toBe(true);
    expect(exceedsOpacityLongPressMoveThreshold(0, 0, 5, 5)).toBe(false);
    expect(exceedsOpacityLongPressMoveThreshold(0, 0, 8, 0)).toBe(false);
    expect(exceedsOpacityLongPressMoveThreshold(0, 0, 9, 0)).toBe(true);
  });
});

describe("OpacityControl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  function setup(activeLayerId: string | null = "era-old") {
    const initial = createInitialState(new Date(2026, 0, 1));
    initial.timeLayer = {
      activeLayerId,
      opacity: 1,
      disabled: activeLayerId === null,
      resolution: {
        candidates: activeLayerId === null ? [] : [activeLayerId],
        reason: "ok",
        snapped: false,
      },
    };
    const store = createStore(initial);
    const parent = document.createElement("div");
    document.body.append(parent);
    const controller = mountOpacityControl(parent, store);
    const root = parent.querySelector<HTMLElement>(".opacity-control");
    const trigger = parent.querySelector<HTMLButtonElement>(".opacity-control__trigger");
    const popover = parent.querySelector<HTMLElement>(".opacity-control__popover");
    const slider = parent.querySelector<HTMLInputElement>(".opacity-control__slider");
    if (root === null || trigger === null || popover === null || slider === null) {
      throw new Error("Expected mounted opacity control.");
    }
    return { controller, parent, root, trigger, popover, slider, store };
  }

  function openWithLongPress(trigger: HTMLButtonElement): void {
    trigger.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(OPACITY_LONG_PRESS_MS);
    trigger.dispatchEvent(pointerEvent("pointerup"));
  }

  it("cycles values on tap and exposes the current value to assistive technology", () => {
    const { controller, root, trigger, store } = setup();

    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute("aria-disabled")).toBe("false");
    expect(trigger.getAttribute("aria-label")).toContain("100%");
    expect(trigger.getAttribute("aria-valuetext")).toContain("100%");

    trigger.click();
    expect(store.get().timeLayer.opacity).toBe(0.6);
    expect(root.dataset.percent).toBe("60");
    expect(trigger.getAttribute("aria-label")).toContain("60%");

    trigger.click();
    trigger.click();
    expect(store.get().timeLayer.opacity).toBe(1);
    expect(root.dataset.level).toBe("full");

    controller.destroy();
  });

  it("disables the control when no layer is active", () => {
    const { controller, root, trigger, store } = setup(null);

    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(root.dataset.disabled).toBe("true");
    trigger.click();
    expect(store.get().timeLayer.opacity).toBe(1);

    controller.destroy();
  });

  it("opens after 500 ms, commits a 5% slider value, and dismisses on release", () => {
    const { controller, popover, slider, store, trigger } = setup();

    expect(slider.getAttribute("step")).toBe(String(OPACITY_SLIDER_STEP_PERCENT));
    expect(slider.getAttribute("aria-orientation")).toBe("vertical");
    expect(popover.hidden).toBe(true);

    trigger.dispatchEvent(pointerEvent("pointerdown", { clientX: 20, clientY: 20 }));
    vi.advanceTimersByTime(OPACITY_LONG_PRESS_MS - 1);
    expect(popover.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(popover.hidden).toBe(false);
    trigger.dispatchEvent(pointerEvent("pointerup", { clientX: 20, clientY: 20 }));

    slider.value = "25";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(pointerEvent("pointerdown"));
    slider.dispatchEvent(pointerEvent("pointerup"));

    expect(store.get().timeLayer.opacity).toBe(0.25);
    expect(popover.hidden).toBe(true);

    controller.destroy();
  });

  it("opens the fine slider from the keyboard and keeps focus on the slider", () => {
    const { controller, popover, slider, trigger } = setup();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

    expect(popover.hidden).toBe(false);
    expect(document.activeElement).toBe(slider);

    controller.destroy();
  });

  it("closes an open popover from outside pointerdown and Escape", () => {
    const { controller, popover, parent, trigger } = setup();
    const outside = document.createElement("div");
    parent.append(outside);

    openWithLongPress(trigger);
    expect(popover.hidden).toBe(false);
    outside.dispatchEvent(pointerEvent("pointerdown"));
    expect(popover.hidden).toBe(true);

    openWithLongPress(trigger);
    expect(popover.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(popover.hidden).toBe(true);

    controller.destroy();
  });
});

import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type I18nKey, type InterpolationVars, type Locale } from "../i18n";

export const OPACITY_LONG_PRESS_MS = 500;
export const OPACITY_LONG_PRESS_MOVE_THRESHOLD_PX = 8;
export const OPACITY_SLIDER_STEP_PERCENT = 5;

const OPACITY_CYCLE = [100, 60, 0] as const;

export interface OpacityControlOptions {
  readonly translate?: (key: I18nKey, vars?: InterpolationVars, locale?: Locale) => string;
}

export interface OpacityControlController {
  destroy(): void;
}

/** Convert the store's normalized opacity to the displayed integer percentage. */
export function opacityPercent(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

/** Cycle the compact control through its three documented tap presets. */
export function cycleOpacityPercent(currentPercent: number): number {
  const current = Math.round(currentPercent);
  const index = OPACITY_CYCLE.indexOf(current as (typeof OPACITY_CYCLE)[number]);
  return index === -1 ? OPACITY_CYCLE[0] : OPACITY_CYCLE[(index + 1) % OPACITY_CYCLE.length]!;
}

/** Return whether a press has reached the long-press threshold. */
export function hasOpacityLongPressElapsed(startedAt: number, now = Date.now()): boolean {
  return (
    Number.isFinite(startedAt) && Number.isFinite(now) && now - startedAt >= OPACITY_LONG_PRESS_MS
  );
}

/** Return whether pointer movement should cancel a pending long press. */
export function exceedsOpacityLongPressMoveThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): boolean {
  if (![startX, startY, currentX, currentY].every(Number.isFinite)) return true;
  return Math.hypot(currentX - startX, currentY - startY) > OPACITY_LONG_PRESS_MOVE_THRESHOLD_PX;
}

function sliderPercent(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const stepped = Math.round(parsed / OPACITY_SLIDER_STEP_PERCENT) * OPACITY_SLIDER_STEP_PERCENT;
  return Math.min(100, Math.max(0, stepped));
}

function opacityLevel(percent: number): "full" | "partial" | "none" {
  if (percent <= 0) return "none";
  if (percent >= 100) return "full";
  return "partial";
}

function isPrimaryPointer(event: PointerEvent): boolean {
  return event.isPrimary !== false && (event.pointerType !== "mouse" || event.button === 0);
}

/** Mount the compact past-layer opacity control into the slider dock. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: OpacityControlOptions = {},
): OpacityControlController {
  const actions = createActions(store);
  const translate = options.translate ?? t;
  const ownerDocument = parent.ownerDocument;
  const root = el("div", {
    class: "opacity-control",
    "data-percent": 100,
    "data-level": "full",
  });
  const trigger = el("button", {
    type: "button",
    class: "opacity-control__trigger",
    "aria-haspopup": "dialog",
    "aria-expanded": "false",
    "aria-disabled": "true",
    disabled: true,
  });
  const icon = el("span", { class: "opacity-control__icon", "aria-hidden": "true" });
  const value = el("span", { class: "opacity-control__value", "aria-hidden": "true" });
  trigger.append(icon, value);

  const popover = el("div", {
    class: "opacity-control__popover",
    role: "dialog",
    "aria-label": translate("opacity.aria", {}, store.get().ui.lang),
  });
  const sliderMin = el(
    "span",
    {
      class: "opacity-control__slider-label",
      "aria-hidden": "true",
    },
    "100%",
  );
  const slider = el("input", {
    type: "range",
    class: "opacity-control__slider",
    min: 0,
    max: 100,
    step: OPACITY_SLIDER_STEP_PERCENT,
    value: 100,
    "aria-label": translate("opacity.aria", {}, store.get().ui.lang),
    "aria-orientation": "vertical",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": 100,
    "aria-valuetext": translate("opacity.label", { percent: 100 }, store.get().ui.lang),
  });
  const sliderMax = el(
    "span",
    {
      class: "opacity-control__slider-label",
      "aria-hidden": "true",
    },
    "0%",
  );
  popover.append(sliderMin, slider, sliderMax);
  root.append(trigger, popover);
  parent.append(root);

  let percent = opacityPercent(store.get().timeLayer.opacity);
  let activeLayerId = store.get().timeLayer.activeLayerId;
  let popoverOpen = false;
  let pressActive = false;
  let longPressOpened = false;
  let suppressNextClick = false;
  let pressStartedAt = Number.NaN;
  let pressStartX = 0;
  let pressStartY = 0;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let sliderPointerActive = false;
  let destroyed = false;

  function clearPressTimer(): void {
    if (pressTimer === null) return;
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  function removePopoverListeners(): void {
    ownerDocument.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    ownerDocument.removeEventListener("keydown", handleDocumentKeyDown);
  }

  function render(): void {
    const disabled = activeLayerId === null;
    const locale = store.get().ui.lang;
    const label = translate("opacity.label", { percent }, locale);
    const level = opacityLevel(percent);

    root.dataset.percent = String(percent);
    root.dataset.level = level;
    root.dataset.disabled = String(disabled);
    trigger.disabled = disabled;
    trigger.setAttribute("aria-disabled", String(disabled));
    trigger.setAttribute("aria-label", label);
    trigger.setAttribute("aria-valuetext", label);
    trigger.setAttribute("aria-expanded", String(popoverOpen && !disabled));
    icon.dataset.level = level;
    value.textContent = `${percent}%`;

    slider.disabled = disabled;
    slider.value = String(percent);
    slider.setAttribute("aria-label", translate("opacity.aria", {}, locale));
    slider.setAttribute("aria-valuenow", String(percent));
    slider.setAttribute("aria-valuetext", label);
    popover.setAttribute("aria-label", translate("opacity.aria", {}, locale));
    popover.hidden = !popoverOpen || disabled;
  }

  function closePopover(restoreFocus = true): void {
    if (!popoverOpen) {
      render();
      return;
    }
    popoverOpen = false;
    removePopoverListeners();
    render();
    if (restoreFocus && !trigger.disabled && root.isConnected) {
      trigger.focus({ preventScroll: true });
    }
  }

  function openPopover(): void {
    if (destroyed || activeLayerId === null) return;
    popoverOpen = true;
    render();
    ownerDocument.addEventListener("pointerdown", handleDocumentPointerDown, true);
    ownerDocument.addEventListener("keydown", handleDocumentKeyDown);
    slider.focus({ preventScroll: true });
  }

  function commitPercent(nextPercent: number): void {
    if (activeLayerId === null) return;
    percent = sliderPercent(String(nextPercent));
    actions.setOpacity(percent);
    render();
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    if (!root.contains(event.target as Node)) closePopover();
  }

  function handleDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closePopover();
  }

  function handleTriggerPointerDown(event: PointerEvent): void {
    if (destroyed || trigger.disabled || !isPrimaryPointer(event)) return;
    clearPressTimer();
    suppressNextClick = false;
    pressActive = true;
    longPressOpened = false;
    pressStartedAt = Date.now();
    pressStartX = event.clientX;
    pressStartY = event.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      if (!pressActive || !hasOpacityLongPressElapsed(pressStartedAt)) return;
      longPressOpened = true;
      suppressNextClick = true;
      openPopover();
    }, OPACITY_LONG_PRESS_MS);
  }

  function cancelTriggerPress(): void {
    if (!pressActive) return;
    pressActive = false;
    clearPressTimer();
  }

  function handleTriggerPointerMove(event: PointerEvent): void {
    if (
      pressActive &&
      !longPressOpened &&
      exceedsOpacityLongPressMoveThreshold(pressStartX, pressStartY, event.clientX, event.clientY)
    ) {
      cancelTriggerPress();
    }
  }

  function handleTriggerPointerUp(): void {
    if (!pressActive) return;
    pressActive = false;
    clearPressTimer();
  }

  function handleTriggerClick(event: MouseEvent): void {
    if (trigger.disabled) {
      event.preventDefault();
      return;
    }
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    actions.setOpacity(cycleOpacityPercent(percent));
  }

  function handleTriggerKeyDown(event: KeyboardEvent): void {
    if (trigger.disabled || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    openPopover();
  }

  function handleSliderInput(): void {
    if (slider.disabled) return;
    const nextPercent = sliderPercent(slider.value);
    percent = nextPercent;
    actions.setOpacity(nextPercent);
    render();
  }

  function handleSliderChange(): void {
    if (slider.disabled) return;
    commitPercent(Number(slider.value));
  }

  function handleSliderPointerDown(event: PointerEvent): void {
    if (slider.disabled || !isPrimaryPointer(event)) return;
    sliderPointerActive = true;
  }

  function finishSliderPointer(): void {
    if (!sliderPointerActive) return;
    sliderPointerActive = false;
    commitPercent(Number(slider.value));
    closePopover();
  }

  function handleSliderKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closePopover();
  }

  const unsubscribeOpacity = store.on(
    (state) => state.timeLayer.opacity,
    (next) => {
      percent = opacityPercent(next);
      render();
    },
  );
  const unsubscribeActiveLayer = store.on(
    (state) => state.timeLayer.activeLayerId,
    (next) => {
      activeLayerId = next;
      if (activeLayerId === null) {
        cancelTriggerPress();
        closePopover(false);
      }
      render();
    },
  );
  const unsubscribeLanguage = store.on(
    (state) => state.ui.lang,
    () => render(),
  );

  trigger.addEventListener("pointerdown", handleTriggerPointerDown);
  trigger.addEventListener("pointermove", handleTriggerPointerMove);
  trigger.addEventListener("pointerup", handleTriggerPointerUp);
  trigger.addEventListener("pointercancel", cancelTriggerPress);
  trigger.addEventListener("pointerleave", cancelTriggerPress);
  trigger.addEventListener("click", handleTriggerClick);
  trigger.addEventListener("keydown", handleTriggerKeyDown);
  slider.addEventListener("input", handleSliderInput);
  slider.addEventListener("change", handleSliderChange);
  slider.addEventListener("pointerdown", handleSliderPointerDown);
  slider.addEventListener("pointerup", finishSliderPointer);
  slider.addEventListener("pointercancel", finishSliderPointer);
  slider.addEventListener("keydown", handleSliderKeyDown);

  render();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelTriggerPress();
      removePopoverListeners();
      unsubscribeOpacity();
      unsubscribeActiveLayer();
      unsubscribeLanguage();
      trigger.removeEventListener("pointerdown", handleTriggerPointerDown);
      trigger.removeEventListener("pointermove", handleTriggerPointerMove);
      trigger.removeEventListener("pointerup", handleTriggerPointerUp);
      trigger.removeEventListener("pointercancel", cancelTriggerPress);
      trigger.removeEventListener("pointerleave", cancelTriggerPress);
      trigger.removeEventListener("click", handleTriggerClick);
      trigger.removeEventListener("keydown", handleTriggerKeyDown);
      slider.removeEventListener("input", handleSliderInput);
      slider.removeEventListener("change", handleSliderChange);
      slider.removeEventListener("pointerdown", handleSliderPointerDown);
      slider.removeEventListener("pointerup", finishSliderPointer);
      slider.removeEventListener("pointercancel", finishSliderPointer);
      slider.removeEventListener("keydown", handleSliderKeyDown);
      root.remove();
    },
  };
}

export { mount as mountOpacityControl };

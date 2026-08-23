import { YEAR_MIN, type AppState } from "../../state/appState";
import { createActions } from "../../state/actions";
import type { Store } from "../../state/store";
import { eraTicks } from "../../providers/layers/resolve";
import type { EraTick, LayerEntry } from "../../providers/layers/types";
import { el } from "../../util/dom";
import { t, type I18nKey, type InterpolationVars, type Locale } from "../i18n";

export const TIME_SLIDER_SETTLE_DEBOUNCE_MS = 150;

export type EraJumpDirection = "next" | "previous";

export interface TimeSliderOptions {
  readonly registry?: readonly LayerEntry[];
  readonly now?: Date;
  readonly currentYear?: number;
  readonly translate?: (key: I18nKey, vars?: InterpolationVars, locale?: Locale) => string;
}

export interface TimeSliderController {
  destroy(): void;
}

interface TrackGeometry {
  readonly left: number;
  readonly width: number;
}

function finiteYear(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clampYear(value: number, minYear: number, maxYear: number): number {
  const lower = Math.min(minYear, maxYear);
  const upper = Math.max(minYear, maxYear);
  return Math.min(upper, Math.max(lower, finiteYear(value, lower)));
}

/** Return the x offset for a year on a track of the supplied width. */
export function yearToX(
  value: number,
  minYear: number,
  maxYear: number,
  trackWidth: number,
): number {
  const width = Math.max(0, finiteYear(trackWidth, 0));
  if (width === 0 || maxYear <= minYear) return 0;
  const year = clampYear(value, minYear, maxYear);
  return ((year - minYear) / (maxYear - minYear)) * width;
}

/** Return the nearest whole year for an x offset on a track. */
export function xToYear(x: number, minYear: number, maxYear: number, trackWidth: number): number {
  if (maxYear <= minYear) return minYear;
  const width = Math.max(0, finiteYear(trackWidth, 0));
  if (width === 0) return minYear;
  const ratio = Math.min(1, Math.max(0, finiteYear(x, 0) / width));
  return clampYear(Math.round(minYear + ratio * (maxYear - minYear)), minYear, maxYear);
}

export const yearToPosition = yearToX;
export const positionToYear = xToYear;

function uniqueEraStarts(ticks: readonly EraTick[]): number[] {
  return [...new Set(ticks.map((tick) => tick.from).filter(Number.isFinite))].sort((a, b) => a - b);
}

/** Move to the next or previous distinct era start, keeping the slider in range. */
export function eraJumpYear(
  value: number,
  direction: EraJumpDirection,
  ticks: readonly EraTick[],
  minYear: number,
  maxYear: number,
): number {
  const current = clampYear(value, minYear, maxYear);
  const starts = uniqueEraStarts(ticks);
  const target =
    direction === "next"
      ? starts.find((start) => start > current)
      : [...starts].reverse().find((start) => start < current);
  return clampYear(target ?? current, minYear, maxYear);
}

/** Resolve a supported slider key to its target year, or null for unrelated keys. */
export function keyboardYear(
  value: number,
  key: string,
  ticks: readonly EraTick[],
  minYear: number,
  maxYear: number,
  shiftKey = false,
): number | null {
  const current = clampYear(value, minYear, maxYear);
  switch (key) {
    case "ArrowLeft":
      return clampYear(current - (shiftKey ? 10 : 1), minYear, maxYear);
    case "ArrowRight":
      return clampYear(current + (shiftKey ? 10 : 1), minYear, maxYear);
    case "PageUp":
      return eraJumpYear(current, "next", ticks, minYear, maxYear);
    case "PageDown":
      return eraJumpYear(current, "previous", ticks, minYear, maxYear);
    case "Home":
      return minYear;
    case "End":
      return maxYear;
    default:
      return null;
  }
}

export const getKeyboardYear = keyboardYear;

function normalizedCurrentYear(now: Date): number {
  return Math.max(YEAR_MIN, Number.isFinite(now.getFullYear()) ? now.getFullYear() : YEAR_MIN);
}

function yearLabel(year: number, locale: Locale): string {
  return locale === "ja" ? `${year}年` : String(year);
}

function eventYearChange(element: HTMLElement, year: number): void {
  element.dispatchEvent(
    new CustomEvent<{ year: number }>("yearchange", {
      bubbles: true,
      detail: { year },
    }),
  );
}

function isPrimaryPointer(event: PointerEvent): boolean {
  return event.isPrimary !== false && (event.pointerType !== "mouse" || event.button === 0);
}

/** Mount the custom, keyboard-accessible time slider into the supplied shell slot. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: TimeSliderOptions = {},
): TimeSliderController {
  const actions = createActions(store);
  const referenceNow = options.now ?? new Date();
  const maxYear = Math.max(
    YEAR_MIN,
    options.currentYear === undefined ? normalizedCurrentYear(referenceNow) : options.currentYear,
  );
  const registry = options.registry ?? [];
  const ticks = eraTicks(registry);
  const translate = options.translate ?? t;

  const root = el("div", {
    class: "time-slider",
    role: "slider",
    tabindex: "0",
    "aria-orientation": "horizontal",
    "aria-valuemin": YEAR_MIN,
    "aria-valuemax": maxYear,
    "aria-label": translate("slider.aria", {}, store.get().ui.lang),
    "aria-disabled": String(store.get().timeLayer.disabled),
    "data-current-year": maxYear,
  });
  const track = el("div", { class: "time-slider__track", "aria-hidden": "true" });
  const trackBase = el("span", { class: "time-slider__track-base" });
  const segments = el("span", { class: "time-slider__segments" });
  const valueLabel = el("span", { class: "time-slider__value", "aria-hidden": "true" });
  const thumbHit = el("span", {
    class: "time-slider__thumb-hit",
    "aria-hidden": "true",
  });
  const thumb = el("span", { class: "time-slider__thumb", "aria-hidden": "true" });
  thumbHit.append(thumb);
  track.append(trackBase, segments, valueLabel, thumbHit);
  root.append(track);
  parent.append(root);

  let displayedYear = clampYear(store.get().year, YEAR_MIN, maxYear);
  let resolution = store.get().timeLayer.resolution;
  let disabled = store.get().timeLayer.disabled;
  let geometry: TrackGeometry = { left: 0, width: 0 };
  let activePointerId: number | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let dragging = false;
  let destroyed = false;
  let resizeObserver: ResizeObserver | undefined;

  function renderPosition(): void {
    const x = yearToX(displayedYear, YEAR_MIN, maxYear, geometry.width);
    thumbHit.style.left = `${x}px`;
    valueLabel.style.left = `${x}px`;
  }

  function renderTicks(): void {
    const candidates = new Set(resolution.candidates);
    segments.replaceChildren();
    for (const tick of ticks) {
      if (tick.to < YEAR_MIN || tick.from > maxYear) continue;
      const from = Math.max(YEAR_MIN, tick.from);
      const to = Math.min(maxYear, tick.to);
      const start = yearToX(from, YEAR_MIN, maxYear, 100);
      const end = yearToX(to, YEAR_MIN, maxYear, 100);
      const segment = el("span", {
        class: "time-slider__era-segment",
        "data-layer-id": tick.layerId,
        "data-from": tick.from,
        "data-to": tick.to,
        "aria-hidden": "true",
      });
      segment.style.left = `${start}%`;
      segment.style.width = `${Math.max(0, end - start)}%`;
      segment.style.opacity = candidates.has(tick.layerId) ? "1" : "0.35";
      segment.classList.toggle("is-available", candidates.has(tick.layerId));
      segments.append(segment);
    }
  }

  function renderAria(): void {
    const locale = store.get().ui.lang;
    const activeLayerId = store.get().timeLayer.activeLayerId;
    const activeLayer = registry.find((entry) => entry.id === activeLayerId);
    const noData =
      resolution.reason === "no-coverage" ||
      resolution.reason === "registry-empty" ||
      activeLayer === undefined;
    const valueText = noData
      ? translate("slider.noData", {}, locale)
      : translate(
          "slider.valuetext",
          { year: displayedYear, layerTitle: activeLayer.title[locale] },
          locale,
        );
    root.setAttribute("aria-valuenow", String(displayedYear));
    root.setAttribute("aria-valuetext", valueText);
    root.setAttribute("aria-label", translate("slider.aria", {}, locale));
    valueLabel.textContent = yearLabel(displayedYear, locale);
  }

  function renderDisabled(): void {
    root.setAttribute("aria-disabled", String(disabled));
    root.dataset.disabled = String(disabled);
    root.tabIndex = disabled ? -1 : 0;
  }

  function cancelDragging(): void {
    clearSettleTimer();
    if (!dragging) return;
    dragging = false;
    const pointerId = activePointerId;
    activePointerId = null;
    delete root.dataset.dragging;
    if (pointerId === null) return;
    try {
      root.releasePointerCapture(pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
  }

  function render(): void {
    renderDisabled();
    renderPosition();
    renderTicks();
    renderAria();
  }

  function setDisplayedYear(value: number): void {
    const next = clampYear(Math.round(value), YEAR_MIN, maxYear);
    if (next === displayedYear) return;
    displayedYear = next;
    renderPosition();
    renderAria();
    eventYearChange(root, displayedYear);
  }

  function measureTrack(): void {
    if (destroyed) return;
    const bounds = track.getBoundingClientRect();
    geometry = {
      left: bounds.left,
      width: Math.max(0, bounds.width || track.clientWidth),
    };
    renderPosition();
  }

  function clearSettleTimer(): void {
    if (settleTimer === null) return;
    clearTimeout(settleTimer);
    settleTimer = null;
  }

  function commitDisplayedYear(): void {
    actions.setYear(displayedYear, referenceNow);
  }

  function scheduleSettle(): void {
    clearSettleTimer();
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (!destroyed) commitDisplayedYear();
    }, TIME_SLIDER_SETTLE_DEBOUNCE_MS);
  }

  function updateFromPointer(event: PointerEvent): void {
    setDisplayedYear(xToYear(event.clientX - geometry.left, YEAR_MIN, maxYear, geometry.width));
  }

  function handlePointerDown(event: PointerEvent): void {
    if (destroyed || disabled || !isPrimaryPointer(event)) return;
    event.preventDefault();
    dragging = true;
    activePointerId = event.pointerId;
    root.dataset.dragging = "true";
    root.focus({ preventScroll: true });
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and older browsers may not implement pointer capture.
    }
    updateFromPointer(event);
    scheduleSettle();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragging || activePointerId !== event.pointerId) return;
    event.preventDefault();
    updateFromPointer(event);
    scheduleSettle();
  }

  function finishPointer(event: PointerEvent): void {
    if (!dragging || activePointerId !== event.pointerId) return;
    clearSettleTimer();
    dragging = false;
    activePointerId = null;
    delete root.dataset.dragging;
    try {
      root.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
    commitDisplayedYear();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = keyboardYear(displayedYear, event.key, ticks, YEAR_MIN, maxYear, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    clearSettleTimer();
    setDisplayedYear(next);
    commitDisplayedYear();
  }

  const view = parent.ownerDocument.defaultView;
  const handleResize = (): void => measureTrack();
  const unsubscribeYear = store.on(
    (state) => state.year,
    (next) => {
      if (!dragging) setDisplayedYear(next);
    },
  );
  const unsubscribeResolution = store.on(
    (state) => state.timeLayer.resolution,
    (next) => {
      resolution = next;
      renderTicks();
      renderAria();
    },
  );
  const unsubscribeDisabled = store.on(
    (state) => state.timeLayer.disabled,
    (next) => {
      disabled = next;
      if (disabled) cancelDragging();
      renderDisabled();
    },
  );
  const unsubscribeActiveLayer = store.on(
    (state) => state.timeLayer.activeLayerId,
    () => renderAria(),
  );
  const unsubscribeLanguage = store.on(
    (state) => state.ui.lang,
    () => renderAria(),
  );

  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("pointermove", handlePointerMove);
  root.addEventListener("pointerup", finishPointer);
  root.addEventListener("pointercancel", finishPointer);
  root.addEventListener("lostpointercapture", finishPointer);
  root.addEventListener("keydown", handleKeyDown);
  view?.addEventListener("resize", handleResize);
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(track);
  }

  render();
  measureTrack();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearSettleTimer();
      resizeObserver?.disconnect();
      view?.removeEventListener("resize", handleResize);
      unsubscribeYear();
      unsubscribeResolution();
      unsubscribeDisabled();
      unsubscribeActiveLayer();
      unsubscribeLanguage();
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerup", finishPointer);
      root.removeEventListener("pointercancel", finishPointer);
      root.removeEventListener("lostpointercapture", finishPointer);
      root.removeEventListener("keydown", handleKeyDown);
      root.remove();
    },
  };
}

export { mount as mountTimeSlider };

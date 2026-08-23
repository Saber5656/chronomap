import type { LayerEntry } from "../../providers/layers/types";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type I18nKey, type InterpolationVars, type Locale } from "../i18n";

export const A11Y_ANNOUNCE_DEBOUNCE_MS = 150;
const A11Y_ANNOUNCE_RETRY_MS = 16;
const A11Y_ANNOUNCE_MAX_RETRIES = 32;

export interface AnnouncerOptions {
  readonly registry?: readonly LayerEntry[];
  readonly translate?: (key: I18nKey, vars?: InterpolationVars, locale?: Locale) => string;
}

export interface AnnouncerController {
  destroy(): void;
}

interface YearChangeDetail {
  readonly year: number;
}

function finiteYear(value: number): number | null {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function fallbackYearText(
  store: Store<AppState>,
  registry: readonly LayerEntry[],
  year: number,
  translate: (key: I18nKey, vars?: InterpolationVars, locale?: Locale) => string,
): string {
  const state = store.get();
  const locale = state.ui.lang;
  const activeLayer = registry.find((entry) => entry.id === state.timeLayer.activeLayerId);
  if (
    activeLayer === undefined ||
    state.timeLayer.resolution.reason === "no-coverage" ||
    state.timeLayer.resolution.reason === "registry-empty"
  ) {
    return translate("slider.noData", {}, locale);
  }
  return translate("slider.valuetext", { year, layerTitle: activeLayer.title[locale] }, locale);
}

function settledSliderValueText(
  store: Store<AppState>,
  registry: readonly LayerEntry[],
  slider: HTMLElement,
  year: number,
): string | null {
  const valueText = slider.getAttribute("aria-valuetext")?.trim();
  if (valueText === undefined || valueText === "") return null;

  const state = store.get();
  const activeLayer = registry.find((entry) => entry.id === state.timeLayer.activeLayerId);
  const noData =
    activeLayer === undefined ||
    state.timeLayer.resolution.reason === "no-coverage" ||
    state.timeLayer.resolution.reason === "registry-empty";
  if (noData) return valueText;

  const yearPrefix = state.ui.lang === "ja" ? `${year}年` : String(year);
  return valueText.startsWith(yearPrefix) ? valueText : null;
}

/** Mount the single polite live region shared by year and layer announcements. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: AnnouncerOptions = {},
): AnnouncerController {
  const registry = options.registry ?? [];
  const translate = options.translate ?? t;
  const root = el("div", {
    class: "a11y-visually-hidden",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "false",
    "aria-relevant": "additions text",
    "data-a11y-announcer": "true",
  });
  const yearMessage = el("span", { "data-a11y-year-announcement": "true" });
  const separator = parent.ownerDocument.createTextNode(" ");
  const layerMessage = el("span", { "data-a11y-layer-announcement": "true" });
  root.append(yearMessage, separator, layerMessage);
  parent.append(root);

  let destroyed = false;
  let yearTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingYear: number | null = null;
  let pendingSlider: HTMLElement | null = null;
  let yearRetryCount = 0;

  function clearYearTimer(): void {
    if (yearTimer === null) return;
    clearTimeout(yearTimer);
    yearTimer = null;
  }

  function renderYear(year: number, slider: HTMLElement | null): void {
    if (destroyed) return;
    const sliderValueText =
      slider === null ? null : settledSliderValueText(store, registry, slider, year);
    yearMessage.textContent = sliderValueText ?? fallbackYearText(store, registry, year, translate);
  }

  function flushYear(): void {
    yearTimer = null;
    if (destroyed || pendingYear === null) return;

    // Pointer dragging commits the store value on the same 150 ms boundary as this timer. If
    // this timer wins the event-loop turn, wait for the slider's commit and its layer resolution
    // notification before reading aria-valuetext.
    if (
      pendingSlider !== null &&
      (store.get().year !== pendingYear ||
        settledSliderValueText(store, registry, pendingSlider, pendingYear) === null) &&
      yearRetryCount < A11Y_ANNOUNCE_MAX_RETRIES
    ) {
      yearRetryCount += 1;
      yearTimer = setTimeout(flushYear, A11Y_ANNOUNCE_RETRY_MS);
      return;
    }

    renderYear(pendingYear, pendingSlider?.isConnected === true ? pendingSlider : null);
    pendingYear = null;
    pendingSlider = null;
    yearRetryCount = 0;
  }

  function scheduleYear(year: number, slider: HTMLElement | null, delayMs: number): void {
    pendingYear = year;
    pendingSlider = slider;
    yearRetryCount = 0;
    clearYearTimer();
    yearTimer = setTimeout(flushYear, delayMs);
  }

  function handleYearChange(event: Event): void {
    const detail = (event as CustomEvent<YearChangeDetail>).detail;
    const year = finiteYear(detail?.year);
    if (year === null) return;
    const slider = event.target instanceof HTMLElement ? event.target : null;
    scheduleYear(year, slider, A11Y_ANNOUNCE_DEBOUNCE_MS);
  }

  function handleLayerChange(next: string | null, previous: string | null): void {
    if (destroyed || next === previous) return;
    const locale = store.get().ui.lang;
    if (next === null) {
      layerMessage.textContent = translate("badge.presentDay", {}, locale);
      return;
    }

    const entry = registry.find((candidate) => candidate.id === next);
    layerMessage.textContent =
      entry === undefined
        ? ""
        : translate(
            "announce.layerChanged",
            {
              layerTitle: entry.title[locale],
            },
            locale,
          );
  }

  const unsubscribeYear = store.on(
    (state) => state.year,
    (next, previous) => {
      if (next === previous) return;
      const year = finiteYear(next);
      if (year === null) return;
      // A slider event already owns the settle timer. Store-only changes (deep links and coverage
      // chips) still get a next-turn announcement after their layer resolution has flushed.
      if (pendingYear === year && yearTimer !== null) return;
      scheduleYear(year, null, 0);
    },
  );
  const unsubscribeLayer = store.on((state) => state.timeLayer.activeLayerId, handleLayerChange);
  parent.addEventListener("yearchange", handleYearChange);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearYearTimer();
      unsubscribeYear();
      unsubscribeLayer();
      parent.removeEventListener("yearchange", handleYearChange);
      root.remove();
      pendingYear = null;
      pendingSlider = null;
      yearRetryCount = 0;
    },
  };
}

export { mount as mountA11yAnnouncer };

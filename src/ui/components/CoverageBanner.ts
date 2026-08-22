import type { MapController } from "../../map/mapController";
import { bboxIntersects, expandBbox, type BoundingBox } from "../../util/geo";
import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import type { LayerEntry } from "../../providers/layers/types";
import { el } from "../../util/dom";
import { t, type I18nKey, type InterpolationVars, type Locale } from "../i18n";

export const COVERAGE_BANNER_HYSTERESIS_MS = 200;
export const SNAPPED_BADGE_DURATION_MS = 4_000;
export const NEARBY_BBOX_FACTOR = 4;

type CoverageI18nKey = Extract<I18nKey, `coverage.${string}`>;
type CoverageMapController = Pick<MapController, "getViewportBbox" | "flyTo">;

export interface NearbyEra {
  readonly entry: LayerEntry;
  readonly year: number;
  readonly bbox: BoundingBox;
  readonly center: Readonly<{ lat: number; lng: number }>;
}

export interface CoverageBannerOptions {
  readonly registry: readonly LayerEntry[];
  readonly mapController: CoverageMapController;
  readonly now?: Date;
  readonly hysteresisMs?: number;
  readonly snappedDurationMs?: number;
  readonly translate?: (
    key: CoverageI18nKey,
    vars: InterpolationVars | undefined,
    locale: Locale,
  ) => string;
}

export interface CoverageBannerController {
  destroy(): void;
}

interface NearbyCandidate extends NearbyEra {
  readonly eraDistance: number;
}

type BannerView =
  | { readonly kind: "no-coverage"; readonly nearby: NearbyEra | null }
  | { readonly kind: "registry-error" }
  | { readonly kind: "snapped"; readonly layer: LayerEntry; readonly selectedYear: number };

function eraDistance(year: number, entry: LayerEntry): number {
  if (year < entry.era.from) return entry.era.from - year;
  if (year > entry.era.to) return year - entry.era.to;
  return 0;
}

function eraMidpoint(entry: LayerEntry): number {
  return Math.round((entry.era.from + entry.era.to) / 2);
}

function bboxCenter(bbox: BoundingBox): Readonly<{ lat: number; lng: number }> {
  return {
    lng: (bbox[0] + bbox[2]) / 2,
    lat: (bbox[1] + bbox[3]) / 2,
  };
}

function pointToBboxDistanceSquared(
  point: Readonly<{ lat: number; lng: number }>,
  bbox: BoundingBox,
): number {
  const closestLng = Math.min(bbox[2], Math.max(bbox[0], point.lng));
  const closestLat = Math.min(bbox[3], Math.max(bbox[1], point.lat));
  return (point.lng - closestLng) ** 2 + (point.lat - closestLat) ** 2;
}

function compareNearbyCandidates(a: NearbyCandidate, b: NearbyCandidate): number {
  if (a.eraDistance !== b.eraDistance) return a.eraDistance - b.eraDistance;

  const aSpan = a.entry.era.to - a.entry.era.from;
  const bSpan = b.entry.era.to - b.entry.era.from;
  if (aSpan !== bSpan) return aSpan - bSpan;
  if (a.entry.priority !== b.entry.priority) return b.entry.priority - a.entry.priority;
  return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
}

/** Select the nearest enabled era intersecting the expanded viewport. */
export function selectNearbyEra(
  registry: readonly LayerEntry[],
  viewBbox: BoundingBox,
  year: number,
  factor = NEARBY_BBOX_FACTOR,
): NearbyEra | null {
  const expanded = expandBbox(viewBbox, factor);
  const viewCenter = bboxCenter(viewBbox);
  const candidates: NearbyCandidate[] = [];

  for (const entry of registry) {
    if (entry.type !== "raster-era") continue;

    let nearestCoverage: BoundingBox | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const coverage of entry.coverage) {
      if (!bboxIntersects(coverage, expanded)) continue;
      const distance = pointToBboxDistanceSquared(viewCenter, coverage);
      if (distance < nearestDistance) {
        nearestCoverage = coverage;
        nearestDistance = distance;
      }
    }
    if (nearestCoverage === undefined) continue;

    candidates.push({
      entry,
      year: eraMidpoint(entry),
      bbox: nearestCoverage,
      center: bboxCenter(nearestCoverage),
      eraDistance: eraDistance(year, entry),
    });
  }

  candidates.sort(compareNearbyCandidates);
  const selected = candidates[0];
  if (selected === undefined) return null;

  return {
    entry: selected.entry,
    year: selected.year,
    bbox: selected.bbox,
    center: selected.center,
  };
}

export const selectNearestEraNearby = selectNearbyEra;

function viewKey(view: BannerView | null): string {
  if (view === null) return "hidden";
  if (view.kind === "registry-error") return view.kind;
  if (view.kind === "snapped") return `${view.kind}:${view.layer.id}:${view.selectedYear}`;
  if (view.nearby === null) return `${view.kind}:none`;
  return `${view.kind}:${view.nearby.entry.id}:${view.nearby.year}:${view.nearby.bbox.join(",")}`;
}

function sameView(a: BannerView | null, b: BannerView | null): boolean {
  return viewKey(a) === viewKey(b);
}

function snappedToken(state: Readonly<AppState>, layer: LayerEntry): string {
  return `${state.year}:${layer.id}:${layer.era.from}:${layer.era.to}`;
}

function defaultTranslate(
  key: CoverageI18nKey,
  vars: InterpolationVars | undefined,
  locale: Locale,
): string {
  return t(key, vars, locale);
}

/** Mount the non-blocking coverage and snapped-era indicator. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: CoverageBannerOptions,
): CoverageBannerController {
  const actions = createActions(store);
  const translate = options.translate ?? defaultTranslate;
  const hysteresisMs = options.hysteresisMs ?? COVERAGE_BANNER_HYSTERESIS_MS;
  const snappedDurationMs = options.snappedDurationMs ?? SNAPPED_BADGE_DURATION_MS;
  const root = el("div", {
    class: "coverage-banner",
    "aria-live": "polite",
    "aria-atomic": "true",
    hidden: true,
  });
  const message = el("span", { class: "coverage-banner__message" });
  const action = el("button", {
    class: "coverage-banner__action",
    type: "button",
    hidden: true,
  });
  root.append(message, action);
  parent.append(root);

  let destroyed = false;
  let renderedView: BannerView | null = null;
  let pendingView: BannerView | null = null;
  let transitionTimer: ReturnType<typeof setTimeout> | null = null;
  let snappedHideTimer: ReturnType<typeof setTimeout> | null = null;
  let activeSnappedToken: string | null = null;
  let hiddenSnappedToken: string | null = null;

  function clearTransitionTimer(): void {
    if (transitionTimer === null) return;
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }

  function clearSnappedHideTimer(): void {
    if (snappedHideTimer === null) return;
    clearTimeout(snappedHideTimer);
    snappedHideTimer = null;
  }

  function locale(): Locale {
    return store.get().ui.lang;
  }

  function renderView(view: BannerView | null): void {
    if (view === null) {
      delete parent.dataset.coverageState;
      root.hidden = true;
      root.removeAttribute("data-state");
      message.textContent = "";
      action.hidden = true;
      action.textContent = "";
      return;
    }

    parent.dataset.coverageState = view.kind;
    root.hidden = false;
    root.dataset.state = view.kind;
    action.hidden = true;
    action.textContent = "";

    if (view.kind === "registry-error") {
      message.textContent = translate("coverage.registryError", undefined, locale());
      return;
    }

    if (view.kind === "snapped") {
      message.textContent = translate(
        "coverage.snapped",
        {
          layerTitle: view.layer.title[locale()],
          from: view.layer.era.from,
          to: view.layer.era.to,
        },
        locale(),
      );
      return;
    }

    message.textContent = translate("coverage.none", undefined, locale());
    if (view.nearby === null) return;

    action.hidden = false;
    action.dataset.layerId = view.nearby.entry.id;
    action.dataset.year = String(view.nearby.year);
    action.textContent = translate("coverage.nearby", { year: view.nearby.year }, locale());
  }

  function applyView(view: BannerView | null): void {
    renderedView = view;
    renderView(view);

    clearSnappedHideTimer();
    if (view?.kind !== "snapped" || activeSnappedToken === null) return;

    const token = activeSnappedToken;
    snappedHideTimer = setTimeout(() => {
      snappedHideTimer = null;
      if (destroyed || renderedView?.kind !== "snapped" || activeSnappedToken !== token) return;
      hiddenSnappedToken = token;
      renderedView = null;
      renderView(null);
    }, snappedDurationMs);
  }

  function scheduleView(nextView: BannerView | null): void {
    if (sameView(nextView, renderedView)) {
      clearTransitionTimer();
      pendingView = null;
      return;
    }
    if (pendingView !== null && sameView(nextView, pendingView)) return;

    clearTransitionTimer();
    pendingView = nextView;
    transitionTimer = setTimeout(() => {
      transitionTimer = null;
      if (destroyed) return;
      const next = pendingView;
      pendingView = null;
      applyView(next);
    }, hysteresisMs);
  }

  function currentView(): BannerView | null {
    const state = store.get();
    const resolution = state.timeLayer.resolution;
    if (resolution.reason === "registry-empty") return { kind: "registry-error" };

    if (resolution.reason === "no-coverage") {
      if (resolution.candidates.length > 0) return { kind: "no-coverage", nearby: null };
      const nearby = selectNearbyEra(
        options.registry,
        options.mapController.getViewportBbox(),
        state.year,
      );
      return { kind: "no-coverage", nearby };
    }

    if (!resolution.snapped || state.timeLayer.activeLayerId === null) return null;
    const layer = options.registry.find((entry) => entry.id === state.timeLayer.activeLayerId);
    return layer === undefined ? null : { kind: "snapped", layer, selectedYear: state.year };
  }

  function update(): void {
    if (destroyed) return;
    const state = store.get();
    const nextView = currentView();

    if (nextView?.kind === "snapped") {
      const nextToken = snappedToken(state, nextView.layer);
      if (activeSnappedToken !== nextToken) {
        activeSnappedToken = nextToken;
        hiddenSnappedToken = null;
        clearSnappedHideTimer();
      }
    } else {
      activeSnappedToken = null;
      hiddenSnappedToken = null;
      clearSnappedHideTimer();
    }

    const targetView =
      nextView?.kind === "snapped" && hiddenSnappedToken === activeSnappedToken ? null : nextView;
    scheduleView(targetView);
  }

  function renderLanguage(): void {
    if (!destroyed) renderView(renderedView);
  }

  function handleNearbyClick(event: MouseEvent): void {
    event.stopPropagation();
    const view = renderedView;
    if (view?.kind !== "no-coverage" || view.nearby === null || destroyed) return;

    const nearby = view.nearby;
    actions.setYear(nearby.year, options.now ?? new Date());
    options.mapController.flyTo({
      lat: nearby.center.lat,
      lng: nearby.center.lng,
      zoom: store.get().view.zoom,
    });
  }

  const unsubscribeResolution = store.on((state) => state.timeLayer.resolution, update);
  const unsubscribeYear = store.on((state) => state.year, update);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, renderLanguage);
  action.addEventListener("click", handleNearbyClick);
  update();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeResolution();
      unsubscribeYear();
      unsubscribeLanguage();
      action.removeEventListener("click", handleNearbyClick);
      clearTransitionTimer();
      clearSnappedHideTimer();
      root.remove();
    },
  };
}

export { mount as mountCoverageBanner };

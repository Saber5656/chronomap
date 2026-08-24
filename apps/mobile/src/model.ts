import gsiRegistryJson from "../../../src/providers/layers/gsi.layers.json";
import {
  loadRegistry,
  resolve,
  type Bbox,
  type LayerEntry,
  type LayerResolution,
} from "../../../src/providers/layers";
import {
  GSI_ATTRIBUTION_TEXT,
  GSI_ATTRIBUTION_URL,
  GSI_PALE_TILE_URL,
} from "../../../src/providers/layers/gsiBasemap";
import { YEAR_MIN, ZOOM_MAX, ZOOM_MIN } from "../../../src/state/appState";
import type { Language } from "./i18n";

export { GSI_ATTRIBUTION_TEXT, GSI_ATTRIBUTION_URL, GSI_PALE_TILE_URL };

export interface MobileRegion {
  readonly latitude: number;
  readonly longitude: number;
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

export interface MobileLayerSelection {
  readonly year: number;
  readonly zoom: number;
  readonly resolution: LayerResolution;
  readonly activeLayer: LayerEntry | null;
}

export interface ResolveMobileLayerInput {
  readonly year: number;
  readonly region: MobileRegion;
  readonly viewportWidth: number;
  readonly currentYear: number;
  readonly registry: readonly LayerEntry[];
}

export const TOKYO_DEMO_REGION: MobileRegion = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export const TOKYO_DEMO_YEAR = 1965;
export const MIN_TOUCH_TARGET = 44;
export const MOBILE_MAP_MIN_ZOOM = 5;
export const MOBILE_MAP_MAX_ZOOM = ZOOM_MAX;
export const MOBILE_MAP_TILE_SIZE = 256;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function regionToBbox(region: MobileRegion): Bbox {
  const latitude = clamp(finiteOr(region.latitude, 0), -90, 90);
  const longitude = clamp(finiteOr(region.longitude, 0), -180, 180);
  const latitudeDelta = clamp(Math.abs(finiteOr(region.latitudeDelta, 0)), 0.000_001, 180);
  const longitudeDelta = clamp(Math.abs(finiteOr(region.longitudeDelta, 0)), 0.000_001, 360);

  const south = clamp(latitude - latitudeDelta / 2, -90, 90 - 0.000_001);
  const north = clamp(latitude + latitudeDelta / 2, south + 0.000_001, 90);
  const west = clamp(longitude - longitudeDelta / 2, -180, 180 - 0.000_001);
  const east = clamp(longitude + longitudeDelta / 2, west + 0.000_001, 180);

  return [west, south, east, north];
}

export function regionToZoom(region: MobileRegion, viewportWidth: number): number {
  const delta = Math.abs(finiteOr(region.longitudeDelta, 360));
  if (delta === 0) return ZOOM_MAX;
  const width =
    Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : MOBILE_MAP_TILE_SIZE;
  const zoom =
    Math.log2(360) + Math.log2(width) - Math.log2(delta) - Math.log2(MOBILE_MAP_TILE_SIZE);
  return clamp(zoom, ZOOM_MIN, ZOOM_MAX);
}

export function createMobileRegistry(currentYear: number): LayerEntry[] {
  return loadRegistry(gsiRegistryJson, {
    currentYear,
    featureFlags: {},
  });
}

export function mobileYearRange(
  registry: readonly LayerEntry[],
  currentYear: number,
): Readonly<{ minimum: number; maximum: number }> {
  const firstRegistryYear = registry.reduce(
    (minimum, entry) => Math.min(minimum, entry.era.from),
    currentYear,
  );
  return {
    minimum: clamp(firstRegistryYear, YEAR_MIN, currentYear),
    maximum: currentYear,
  };
}

export function resolveMobileLayer(input: ResolveMobileLayerInput): MobileLayerSelection {
  const normalizedCurrentYear = Math.max(YEAR_MIN, Math.trunc(input.currentYear));
  const year = clamp(Math.round(input.year), YEAR_MIN, normalizedCurrentYear);
  const zoom = regionToZoom(input.region, input.viewportWidth);
  const resolution = resolve({
    year,
    viewBbox: regionToBbox(input.region),
    zoom,
    currentYear: normalizedCurrentYear,
    registry: input.registry,
  });
  const activeLayer = input.registry.find((entry) => entry.id === resolution.activeLayerId) ?? null;

  return { year, zoom, resolution, activeLayer };
}

export function layerTitle(layer: LayerEntry, language: Language): string {
  return layer.title[language];
}

export function attributionLabel(layer: LayerEntry | null, basemapCredit: string): string {
  if (layer === null || layer.attribution.text === basemapCredit) return basemapCredit;
  return `${basemapCredit} / ${layer.attribution.text}`;
}

export function eraLabel(layer: LayerEntry): string {
  return layer.era.from === layer.era.to
    ? String(layer.era.from)
    : `${layer.era.from}–${layer.era.to}`;
}

import { label as validateLabel, latLng, opacity, year, zoom } from "../security/validate";
import type { AppState } from "./appState";
import { YEAR_MIN } from "./appState";

const DEFAULT_VIEW: AppState["view"] = { lat: 36.5, lng: 138.5, zoom: 5 };
const LAYER_ID_PATTERN = /^[a-z0-9-]{1,64}$/u;
const DECIMAL_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/u;
const SEARCH_LENGTH_LIMIT = 2_048;

export interface UrlState {
  view: AppState["view"];
  year: AppState["year"];
  requestedLayerId: AppState["requestedLayerId"];
  timeLayer: Pick<AppState["timeLayer"], "opacity">;
  poi: Pick<AppState["poi"], "enabled">;
  label: string | null;
}

export type UrlStatePatch = Partial<UrlState>;

export interface SerializableUrlState {
  view: AppState["view"];
  year: AppState["year"];
  requestedLayerId: AppState["requestedLayerId"];
  timeLayer: Pick<AppState["timeLayer"], "opacity">;
  poi: Pick<AppState["poi"], "enabled">;
  label?: string | null;
}

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function currentYear(now: Date): number {
  const value = now.getFullYear();
  return Number.isFinite(value) ? Math.max(YEAR_MIN, value) : YEAR_MIN;
}

function validatedLayerId(value: string, registryIds: ReadonlySet<string>): string | null {
  return LAYER_ID_PATTERN.test(value) && registryIds.has(value) ? value : null;
}

export function parseUrlState(
  search: string,
  now: Date,
  registryIds: ReadonlySet<string>,
): UrlStatePatch {
  if (search.length > SEARCH_LENGTH_LIMIT) return {};

  const params = new URLSearchParams(search);
  const patch: UrlStatePatch = {};
  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  const rawZoom = params.get("z");

  if (rawLat !== null || rawLng !== null || rawZoom !== null) {
    // Invalid or missing view components fall back independently; finite values clamp before
    // coordinate/zoom rounding so one bad component never discards the other URL parameters.
    const parsedLat = rawLat === null ? DEFAULT_VIEW.lat : parseDecimal(rawLat);
    const parsedLng = rawLng === null ? DEFAULT_VIEW.lng : parseDecimal(rawLng);
    const parsedZoom = rawZoom === null ? DEFAULT_VIEW.zoom : parseDecimal(rawZoom);
    const coordinates = latLng(parsedLat ?? DEFAULT_VIEW.lat, parsedLng ?? DEFAULT_VIEW.lng);
    const validatedZoom = zoom(parsedZoom ?? DEFAULT_VIEW.zoom);
    patch.view = {
      ...(coordinates ?? { lat: DEFAULT_VIEW.lat, lng: DEFAULT_VIEW.lng }),
      zoom: round(validatedZoom ?? DEFAULT_VIEW.zoom, 2),
    };
  }

  const rawYear = params.get("year");
  if (rawYear !== null) {
    // Finite integer years clamp to 1890..currentYear; malformed or fractional values use today.
    const parsed = parseDecimal(rawYear);
    patch.year = (parsed === null ? null : year(parsed, now)) ?? currentYear(now);
  }

  const rawLayer = params.get("l");
  if (rawLayer !== null) {
    // Syntax-valid IDs still fall back to no override unless the loaded registry contains them.
    patch.requestedLayerId = validatedLayerId(rawLayer, registryIds);
  }

  const rawOpacity = params.get("op");
  if (rawOpacity !== null) {
    // Finite integer percentages clamp to 0..100; malformed or fractional values use 100%.
    const parsed = parseDecimal(rawOpacity);
    patch.timeLayer = { opacity: (parsed === null ? null : opacity(parsed)) ?? 1 };
  }

  const rawPoi = params.get("poi");
  if (rawPoi !== null) {
    // Only `0` disables POIs; `1` is enabled and every invalid value falls back to enabled.
    patch.poi = { enabled: rawPoi === "0" ? false : true };
  }

  const rawLabel = params.get("label");
  if (rawLabel !== null) {
    // Labels preserve plain-text markup, strip controls, cap at 120 points, and default to none.
    patch.label = validateLabel(rawLabel);
  }

  return patch;
}

export function serializeUrlState(
  state: SerializableUrlState,
  registryIds: ReadonlySet<string>,
  now: Date = new Date(),
): string {
  const params = new URLSearchParams();
  const coordinates = latLng(state.view.lat, state.view.lng);
  const validatedZoom = zoom(state.view.zoom);

  if (coordinates !== null) {
    if (coordinates.lat !== DEFAULT_VIEW.lat) params.set("lat", String(coordinates.lat));
    if (coordinates.lng !== DEFAULT_VIEW.lng) params.set("lng", String(coordinates.lng));
  }
  if (validatedZoom !== null) {
    const roundedZoom = round(validatedZoom, 2);
    if (roundedZoom !== DEFAULT_VIEW.zoom) params.set("z", String(roundedZoom));
  }

  const validatedYear = year(state.year, now);
  if (validatedYear !== null && validatedYear !== currentYear(now)) {
    params.set("year", String(validatedYear));
  }

  if (
    state.requestedLayerId !== null &&
    validatedLayerId(state.requestedLayerId, registryIds) !== null
  ) {
    params.set("l", state.requestedLayerId);
  }

  if (Number.isFinite(state.timeLayer.opacity)) {
    const percent = Math.round(Math.min(1, Math.max(0, state.timeLayer.opacity)) * 100);
    if (percent !== 100) params.set("op", String(percent));
  }

  if (!state.poi.enabled) params.set("poi", "0");

  const sanitizedLabel = validateLabel(state.label ?? null);
  if (sanitizedLabel !== null) params.set("label", sanitizedLabel);

  const query = params.toString();
  return query.length === 0 ? "" : `?${query}`;
}

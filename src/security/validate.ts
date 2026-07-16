import { YEAR_MIN, ZOOM_MAX, ZOOM_MIN } from "../state/appState";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Issue 11 extends this module with the complete boundary-validation contract. */
export function latLng(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat: Math.round(clamp(lat, -90, 90) * 1_000_000) / 1_000_000,
    lng: Math.round(clamp(lng, -180, 180) * 1_000_000) / 1_000_000,
  };
}

export function zoom(value: number): number | null {
  return Number.isFinite(value) ? clamp(value, ZOOM_MIN, ZOOM_MAX) : null;
}

export function year(value: number, now: Date): number | null {
  const currentYear = now.getFullYear();
  return Number.isInteger(value) && Number.isFinite(currentYear)
    ? clamp(value, YEAR_MIN, currentYear)
    : null;
}

export function opacity(value: number): number | null {
  return Number.isInteger(value) ? clamp(value, 0, 100) / 100 : null;
}

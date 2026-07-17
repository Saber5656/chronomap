import { YEAR_MIN, ZOOM_MAX, ZOOM_MIN } from "../state/appState";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const sanitized = value.normalize("NFC").replace(CONTROL_CHARACTERS, "").trim();
  return sanitized.length === 0 ? null : sanitized;
}

function truncateCodePoints(value: string, limit: number): string {
  const codePoints = [...value];
  return codePoints.length <= limit ? value : codePoints.slice(0, limit).join("");
}

export function finiteInRange(value: unknown, min: number, max: number): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min > max
  ) {
    return null;
  }

  return clamp(value, min, max);
}

export function intInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value)
    ? finiteInRange(value, min, max)
    : null;
}

export function latLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const validatedLat = finiteInRange(lat, -90, 90);
  const validatedLng = finiteInRange(lng, -180, 180);
  if (validatedLat === null || validatedLng === null) return null;

  return {
    lat: Math.round(validatedLat * 1_000_000) / 1_000_000,
    lng: Math.round(validatedLng * 1_000_000) / 1_000_000,
  };
}

export function zoom(value: unknown): number | null {
  return finiteInRange(value, ZOOM_MIN, ZOOM_MAX);
}

export function year(value: unknown, now: Date): number | null {
  return intInRange(value, YEAR_MIN, now.getFullYear());
}

export function opacity(value: unknown): number | null {
  const percent = intInRange(value, 0, 100);
  return percent === null ? null : percent / 100;
}

export function label(value: unknown): string | null {
  const sanitized = sanitizeText(value);
  return sanitized === null ? null : truncateCodePoints(sanitized, 120);
}

export function poiTitle(value: unknown): string | null {
  const sanitized = sanitizeText(value);
  if (sanitized === null) return null;

  return [...sanitized].length <= 300 ? sanitized : null;
}

export function extract(value: unknown): string | null {
  const sanitized = sanitizeText(value);
  if (sanitized === null) return null;

  const codePoints = [...sanitized];
  return codePoints.length <= 1_200 ? sanitized : `${codePoints.slice(0, 1_199).join("")}…`;
}

export function httpsUrl(value: unknown, allowedHosts: ReadonlySet<string>): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      !allowedHosts.has(url.hostname)
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

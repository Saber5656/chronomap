import { latLng, MAX_ACCURACY_METERS } from "../security/validate";

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

export type GeoErrorStatus = "denied" | "unavailable" | "timeout";

export interface Fix {
  lat: number;
  lng: number;
  accuracyM: number;
  at: number;
}

/** A sanitized error used at the UI boundary; browser error messages never reach the UI. */
export class GeoError extends Error {
  readonly status: GeoErrorStatus;

  constructor(status: GeoErrorStatus) {
    super(`Geolocation ${status}.`);
    this.name = "GeoError";
    this.status = status;
  }
}

export function mapGeolocationErrorCode(code: number): GeoErrorStatus {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

function isSecureContextAvailable(): boolean {
  // The browser must positively attest to a secure context. Treat an absent flag as
  // unavailable as well, because an older WebView must not receive a location prompt
  // when its delivery context cannot be verified.
  return typeof window !== "undefined" && window.isSecureContext === true;
}

export function isGeolocationAvailable(): boolean {
  if (!isSecureContextAvailable() || typeof navigator === "undefined") return false;

  const geolocation = navigator.geolocation;
  return typeof geolocation?.getCurrentPosition === "function";
}

function toFix(position: GeolocationPosition): Fix | null {
  if (typeof position !== "object" || position === null) return null;
  if (typeof position.coords !== "object" || position.coords === null) return null;

  const coordinates = latLng(position.coords.latitude, position.coords.longitude);
  const accuracyM = position.coords.accuracy;
  const at = position.timestamp;

  if (
    coordinates === null ||
    !Number.isFinite(accuracyM) ||
    accuracyM < 0 ||
    accuracyM > MAX_ACCURACY_METERS ||
    !Number.isFinite(at)
  ) {
    return null;
  }

  return { ...coordinates, accuracyM, at };
}

/** Acquire exactly one browser position. This function never persists or transmits the fix. */
export function requestFix(): Promise<Fix> {
  if (!isGeolocationAvailable()) return Promise.reject(new GeoError("unavailable"));

  return new Promise<Fix>((resolve, reject) => {
    const geolocation = navigator.geolocation;
    if (geolocation === undefined) {
      reject(new GeoError("unavailable"));
      return;
    }

    try {
      geolocation.getCurrentPosition(
        (position) => {
          try {
            const fix = toFix(position);
            rejectOrResolve(fix, resolve, reject);
          } catch {
            reject(new GeoError("unavailable"));
          }
        },
        (error) => reject(new GeoError(mapGeolocationErrorCode(error.code))),
        GEOLOCATION_OPTIONS,
      );
    } catch {
      reject(new GeoError("unavailable"));
    }
  });
}

function rejectOrResolve(
  fix: Fix | null,
  resolve: (value: Fix | PromiseLike<Fix>) => void,
  reject: (reason?: unknown) => void,
): void {
  if (fix === null) {
    reject(new GeoError("unavailable"));
    return;
  }
  resolve(fix);
}

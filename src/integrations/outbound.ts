import { assertIntegerZoom, assertLatLng } from "../security/validate";

declare const outboundUrlBrand: unique symbol;

/** A URL produced by one of the hardcoded outbound map builders. */
export type OutboundUrl = string & { readonly [outboundUrlBrand]: "OutboundUrl" };

export type MapHandoffTarget = "google" | "apple" | "geo";

const GOOGLE_MAPS_PREFIX = "https://www.google.com/maps/search/?api=1&query=";
const APPLE_MAPS_PREFIX = "https://maps.apple.com/?ll=";
const GENERATED_OUTBOUND_URL_PATTERN =
  /^(?:https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=[+-]?(?:\d+\.\d{6})%2C[+-]?(?:\d+\.\d{6})|https:\/\/maps\.apple\.com\/\?ll=[+-]?(?:\d+\.\d{6}),[+-]?(?:\d+\.\d{6})|geo:[+-]?(?:\d+\.\d{6}),[+-]?(?:\d+\.\d{6})(?:\?z=\d+)?)$/u;

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function createOutboundUrl(value: string): OutboundUrl {
  return value as OutboundUrl;
}

function coordinatesForOutbound(lat: number, lng: number): string {
  const coordinates = assertLatLng(lat, lng);
  return `${formatCoordinate(coordinates.lat)},${formatCoordinate(coordinates.lng)}`;
}

/** Build a Google Maps URL without accepting labels or other user-controlled URL parts. */
export function buildGoogleMapsUrl(lat: number, lng: number): OutboundUrl {
  const coordinates = coordinatesForOutbound(lat, lng).replace(",", "%2C");
  return createOutboundUrl(`${GOOGLE_MAPS_PREFIX}${coordinates}`);
}

/** Build an Apple Maps URL without accepting labels or other user-controlled URL parts. */
export function buildAppleMapsUrl(lat: number, lng: number): OutboundUrl {
  return createOutboundUrl(`${APPLE_MAPS_PREFIX}${coordinatesForOutbound(lat, lng)}`);
}

/** Build an Android-compatible geo URI. The zoom query is omitted when no zoom is supplied. */
export function buildGeoUri(lat: number, lng: number, zoom?: number): OutboundUrl {
  const coordinates = coordinatesForOutbound(lat, lng);
  const zoomQuery = zoom === undefined ? "" : `?z=${assertIntegerZoom(zoom)}`;
  return createOutboundUrl(`geo:${coordinates}${zoomQuery}`);
}

function assertGeneratedOutboundUrl(url: OutboundUrl): void {
  if (!GENERATED_OUTBOUND_URL_PATTERN.test(url)) {
    throw new TypeError("URL must be produced by an outbound map URL builder.");
  }
}

function requestExternal(url: OutboundUrl): Window | null {
  assertGeneratedOutboundUrl(url);
  try {
    return window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    return null;
  }
}

/** Open a builder-produced URL with reverse-tabnabbing and referrer protections. */
export function openExternal(url: OutboundUrl): void {
  void requestExternal(url);
}

/** Internal UI helper that also reports popup-blocked browsers without weakening the URL brand. */
export function openExternalWithResult(url: OutboundUrl): boolean {
  return requestExternal(url) !== null;
}

function currentUserAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

/**
 * Return presentation order based on the user agent only.
 *
 * iOS browsers do not expose a `geo:` handler, so that entry is intentionally hidden there.
 * Every other supported target remains visible; ordering is only a discoverability hint and does
 * not claim that a particular native app is installed.
 */
export function mapHandoffTargets(userAgent = currentUserAgent()): readonly MapHandoffTarget[] {
  const isIos =
    /iPad|iPhone|iPod/iu.test(userAgent) ||
    (/Macintosh/iu.test(userAgent) && /Mobile/iu.test(userAgent));
  if (isIos) return ["apple", "google"];
  if (/Android/iu.test(userAgent)) return ["google", "geo", "apple"];
  return ["google", "apple", "geo"];
}

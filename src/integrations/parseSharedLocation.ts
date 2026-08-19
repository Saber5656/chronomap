import { label as validateLabel, latLng, zoom as validateZoom } from "../security/validate";

const RAW_LENGTH_LIMIT = 4_096;
const URLISH_TOKEN_PATTERN = /(?<![\p{L}\p{N}_])(?:[a-z][a-z\d+.-]*:)[^\s]+/iu;
const COORDINATE = "-?\\d{1,3}(?:\\.\\d+)?";
const GEO_COORDINATE_PATTERN = new RegExp(
  `^(${COORDINATE}),(${COORDINATE})(?:,${COORDINATE})?$`,
  "u",
);
const EXACT_PAIR_PATTERN = new RegExp(`^\\s*(${COORDINATE})\\s*,\\s*(${COORDINATE})\\s*$`, "u");
const PLAIN_PAIR_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_.+-])(${COORDINATE})[,\\s]+(${COORDINATE})(?![\\p{L}\\p{N}_])`,
  "u",
);
const GOOGLE_PATH_PATTERN = new RegExp(`@(${COORDINATE}),(${COORDINATE})(?:,(\\d+)z)?(?=$|/)`, "u");
const DECIMAL_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/u;
const GOOGLE_HOSTS = new Set([
  "www.google.com",
  "google.com",
  "maps.google.com",
  "www.google.co.jp",
  "maps.google.co.jp",
]);
const SHORTLINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

export type RecognizerId = "geo" | "apple" | "google" | "plain";

export type ParseResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      zoom?: number;
      label?: string;
      source: RecognizerId;
    }
  | { ok: false; reason: "shortlink" | "no-coords" | "invalid" };

type Coordinates = { lat: number; lng: number };
type SuccessfulParse = Extract<ParseResult, { ok: true }>;

function coordinatePair(latText: string, lngText: string): Coordinates | null {
  const lat = Number(latText);
  const lng = Number(lngText);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return latLng(lat, lng);
}

function pairFromMatch(match: RegExpMatchArray | null): Coordinates | null {
  return match === null ? null : coordinatePair(match[1]!, match[2]!);
}

function parsePair(value: string, pattern: RegExp): Coordinates | null {
  return pairFromMatch(pattern.exec(value));
}

function makeSuccess(
  source: RecognizerId,
  coordinates: Coordinates,
  parsedZoom: number | null,
  parsedLabel: string | null,
): SuccessfulParse {
  const result: SuccessfulParse = { ok: true, ...coordinates, source };
  if (parsedZoom !== null) result.zoom = parsedZoom;
  if (parsedLabel !== null) result.label = parsedLabel;
  return result;
}

function parseGeoZoom(rawZoom: string | null): number | null {
  if (rawZoom === null) return null;

  const trimmed = rawZoom.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return validateZoom(parsed);
}

function parseGooglePathZoom(rawZoom: string | undefined): number | null {
  if (rawZoom === undefined) return null;

  const parsed = Number(rawZoom);
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 21) return null;

  return validateZoom(parsed);
}

function parseGeo(url: URL): ParseResult | null {
  const coordinates = parsePair(url.pathname, GEO_COORDINATE_PATTERN);
  if (coordinates === null) return null;

  return makeSuccess("geo", coordinates, parseGeoZoom(url.searchParams.get("z")), null);
}

function parseApple(url: URL, hostname: string): ParseResult | null {
  if (hostname !== "maps.apple.com") return null;

  const coordinates = parsePair(url.searchParams.get("ll") ?? "", EXACT_PAIR_PATTERN);
  if (coordinates === null) return { ok: false, reason: "no-coords" };

  return makeSuccess("apple", coordinates, null, validateLabel(url.searchParams.get("q")));
}

function parseGoogle(url: URL, hostname: string): ParseResult | null {
  if (!GOOGLE_HOSTS.has(hostname) || !url.pathname.includes("/maps")) return null;

  const queryCoordinates = parsePair(url.searchParams.get("query") ?? "", EXACT_PAIR_PATTERN);
  if (queryCoordinates !== null) return makeSuccess("google", queryCoordinates, null, null);

  const qCoordinates = parsePair(url.searchParams.get("q") ?? "", EXACT_PAIR_PATTERN);
  if (qCoordinates !== null) return makeSuccess("google", qCoordinates, null, null);

  const pathMatch = GOOGLE_PATH_PATTERN.exec(url.pathname);
  if (pathMatch === null) return { ok: false, reason: "no-coords" };

  const pathCoordinates = pairFromMatch(pathMatch);
  if (pathCoordinates === null) return { ok: false, reason: "no-coords" };

  return makeSuccess("google", pathCoordinates, parseGooglePathZoom(pathMatch[3]), null);
}

function parseUrlCandidate(token: string): URL | null {
  try {
    return new URL(token);
  } catch {
    return null;
  }
}

// Recognizer order is contractual: geo → Apple → Google → shortlink → plain pair. Append new
// recognizers only, or update the canonical spec and its regression table explicitly.
function parseUrlRecognizers(url: URL): ParseResult | null {
  if (url.protocol === "geo:") return parseGeo(url);
  if (url.protocol !== "https:") return null;

  const hostname = url.hostname.toLowerCase();
  const appleResult = parseApple(url, hostname);
  if (appleResult !== null) return appleResult;

  const googleResult = parseGoogle(url, hostname);
  if (googleResult !== null) return googleResult;

  if (SHORTLINK_HOSTS.has(hostname)) return { ok: false, reason: "shortlink" };
  return null;
}

function firstUrlishToken(value: string): string | null {
  return value.match(URLISH_TOKEN_PATTERN)?.[0] ?? null;
}

export function parseSharedLocation(raw: string): ParseResult {
  try {
    if (typeof raw !== "string" || raw.length > RAW_LENGTH_LIMIT) {
      return { ok: false, reason: "invalid" };
    }

    const normalized = raw.trim().normalize("NFC");
    const token = firstUrlishToken(normalized);
    const url = token === null ? null : parseUrlCandidate(token);
    if (url !== null && (url.username !== "" || url.password !== "")) {
      return { ok: false, reason: "invalid" };
    }

    const urlResult = url === null ? null : parseUrlRecognizers(url);
    if (urlResult !== null) return urlResult;

    const coordinates = parsePair(normalized, PLAIN_PAIR_PATTERN);
    if (coordinates !== null) return makeSuccess("plain", coordinates, null, null);

    return { ok: false, reason: "no-coords" };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

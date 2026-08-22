import { assertLatLng } from "../../security/validate";
import { POI_MAX, POI_MIN_ZOOM } from "../../state/appState";
import { guardPois } from "./guards";
import { cachedFetch } from "./wikimediaClient";
import type { Poi, PoiProvider, PoiProviderError } from "./types";

export type WikipediaLanguage = "ja" | "en";

const WIKIPEDIA_HOSTS: Record<WikipediaLanguage, string> = {
  ja: "ja.wikipedia.org",
  en: "en.wikipedia.org",
};

type UnknownRecord = Record<string, unknown>;

interface NormalizedSearchQuery {
  readonly lat: number;
  readonly lng: number;
  readonly radiusM: number;
  readonly signal: AbortSignal | undefined;
}

class WikipediaProviderException extends Error implements PoiProviderError {
  readonly kind: PoiProviderError["kind"];

  constructor(kind: PoiProviderError["kind"]) {
    super(kind);
    this.name = "PoiProviderError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWikipediaLanguage(value: unknown): value is WikipediaLanguage {
  return value === "ja" || value === "en";
}

function malformedError(): WikipediaProviderException {
  return new WikipediaProviderException("malformed");
}

function abortedError(): WikipediaProviderException {
  return new WikipediaProviderException("aborted");
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    isRecord(value) &&
    typeof value.aborted === "boolean" &&
    typeof value.addEventListener === "function"
  );
}

function normalizeRadius(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(10_000, Math.max(100, Math.round(value)));
}

function normalizeSearchQuery(
  lang: WikipediaLanguage,
  query: unknown,
): NormalizedSearchQuery | null {
  try {
    if (!isRecord(query)) return null;
    if (!isWikipediaLanguage(query.locale) || query.locale !== lang) return null;
    if (typeof query.lat !== "number" || typeof query.lng !== "number") return null;

    const coordinates = assertLatLng(query.lat, query.lng);
    const radiusM = normalizeRadius(query.radiusM);
    if (radiusM === null) return null;

    const signal = query.signal;
    if (signal !== undefined && !isAbortSignal(signal)) return null;

    return { ...coordinates, radiusM, signal };
  } catch {
    return null;
  }
}

function fixedCoordinate(value: number): string {
  return value.toFixed(6);
}

function cacheCoordinate(value: number): string {
  const rounded = Math.round(value * 1_000) / 1_000;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(3);
}

function radiusBucket(radiusM: number): number {
  return Math.round(radiusM / 500) * 500;
}

function cacheKey(lang: WikipediaLanguage, query: NormalizedSearchQuery): string {
  return `wikipedia:${lang}:${cacheCoordinate(query.lat)}:${cacheCoordinate(query.lng)}:${radiusBucket(query.radiusM)}`;
}

function buildUrl(lang: WikipediaLanguage, query: NormalizedSearchQuery): URL {
  const url = new URL(`https://${WIKIPEDIA_HOSTS[lang]}/w/api.php`);
  const params = new URLSearchParams();
  params.set("action", "query");
  params.set("list", "geosearch");
  params.set("gscoord", `${fixedCoordinate(query.lat)}|${fixedCoordinate(query.lng)}`);
  params.set("gsradius", String(query.radiusM));
  params.set("gslimit", "50");
  params.set("gsnamespace", "0");
  params.set("format", "json");
  params.set("origin", "*");
  url.search = params.toString();
  return url;
}

function responseGeosearch(value: unknown): readonly unknown[] {
  try {
    if (!isRecord(value)) throw malformedError();
    if ("error" in value) throw malformedError();

    const query = value.query;
    if (query === undefined) return [];
    if (!isRecord(query)) throw malformedError();

    const geosearch = query.geosearch;
    if (geosearch === undefined || geosearch === null) return [];
    if (!Array.isArray(geosearch)) throw malformedError();
    return geosearch;
  } catch {
    throw malformedError();
  }
}

function mapGeosearchItem(value: unknown, lang: WikipediaLanguage): unknown {
  try {
    if (!isRecord(value)) return null;

    const pageid = value.pageid;
    const namespace = value.ns;
    const distance = value.dist;
    if (typeof pageid !== "number" || !Number.isSafeInteger(pageid) || pageid <= 0) return null;
    if (namespace !== undefined && namespace !== 0) return null;
    if (typeof distance !== "number" || !Number.isFinite(distance) || distance < 0) return null;

    return {
      id: `wikipedia-${lang}:${pageid}`,
      title: value.title,
      lat: value.lat,
      lng: value.lon,
      distanceM: distance,
      source: {
        provider: "wikipedia",
        lang,
        url: `https://${WIKIPEDIA_HOSTS[lang]}/?curid=${pageid}`,
      },
    };
  } catch {
    return null;
  }
}

async function searchWikipedia(lang: WikipediaLanguage, query: unknown): Promise<Poi[]> {
  const normalized = normalizeSearchQuery(lang, query);
  if (normalized === null) throw malformedError();
  if (normalized.signal?.aborted) throw abortedError();

  const response = await cachedFetch(
    cacheKey(lang, normalized),
    buildUrl(lang, normalized),
    normalized.signal === undefined ? {} : { signal: normalized.signal },
  );
  const candidates = responseGeosearch(response).map((item) => mapGeosearchItem(item, lang));
  return guardPois(candidates).items.slice(0, POI_MAX);
}

/** Create the locale-bound Wikipedia GeoSearch provider. */
export function createWikipediaProvider(lang: WikipediaLanguage): PoiProvider {
  if (!isWikipediaLanguage(lang)) {
    throw new RangeError("Wikipedia provider language must be ja or en.");
  }

  return {
    id: "wikipedia",
    minZoom: POI_MIN_ZOOM,
    search: (query) => searchWikipedia(lang, query),
  };
}

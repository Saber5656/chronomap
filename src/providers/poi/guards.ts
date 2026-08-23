import { extract, httpsUrl, latLng, poiTitle } from "../../security/validate";
import { WIKIMEDIA_IMG_HOSTS } from "../../security/hosts";
import type { Poi, PoiDetail } from "./types";

const WIKIPEDIA_LANGUAGES = new Set(["ja", "en"]);
const WIKIPEDIA_PAGE_HOSTS = new Set(["ja.wikipedia.org", "en.wikipedia.org"]);
const COMMONS_PAGE_HOSTS = new Set([["commons", "wikimedia", "org"].join(".")]);

type UnknownRecord = Record<string, unknown>;

export interface GuardedPois {
  items: Poi[];
  dropped: number;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSupportedLanguage(value: unknown): value is string {
  return typeof value === "string" && WIKIPEDIA_LANGUAGES.has(value);
}

function validateSource(value: unknown): Poi["source"] | null {
  if (!isRecord(value)) return null;

  const provider = value.provider;
  const lang = value.lang;
  const url = value.url;
  if (!isNonBlankString(lang) || !isNonBlankString(url)) return null;

  if (provider === "wikipedia") {
    if (!isSupportedLanguage(lang)) return null;
    const normalizedUrl = httpsUrl(url, new Set([`${lang}.wikipedia.org`]));
    return normalizedUrl === null ? null : { provider, lang, url: normalizedUrl };
  }

  if (provider === "commons") {
    if (!isSupportedLanguage(lang)) return null;
    const normalizedUrl = httpsUrl(url, COMMONS_PAGE_HOSTS);
    return normalizedUrl === null ? null : { provider, lang, url: normalizedUrl };
  }

  return null;
}

function validateDistance(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function assertPoi(raw: unknown): Poi | null {
  try {
    if (!isRecord(raw)) return null;

    const id = raw.id;
    const title = poiTitle(raw.title);
    const coordinates = latLng(raw.lat, raw.lng);
    const distanceM = validateDistance(raw.distanceM);
    const source = validateSource(raw.source);

    if (!isNonBlankString(id) || title === null || coordinates === null || distanceM === null) {
      return null;
    }
    if (source === null) return null;

    const poi: Poi = {
      id,
      title,
      ...coordinates,
      source,
    };
    if (distanceM !== undefined) poi.distanceM = distanceM;
    return poi;
  } catch {
    return null;
  }
}

export function assertPoiDetail(raw: unknown): PoiDetail | null {
  try {
    if (!isRecord(raw)) return null;

    const validatedExtract = extract(raw.extract);
    const pageUrl = httpsUrl(raw.pageUrl, WIKIPEDIA_PAGE_HOSTS);
    if (validatedExtract === null || pageUrl === null) return null;
    if (raw.attributionKey !== "wikipedia-ccbysa") return null;

    const detail: PoiDetail = {
      extract: validatedExtract,
      pageUrl,
      attributionKey: "wikipedia-ccbysa",
    };
    if (raw.thumbnailUrl !== undefined) {
      const thumbnailUrl = httpsUrl(raw.thumbnailUrl, WIKIMEDIA_IMG_HOSTS);
      if (thumbnailUrl === null) return null;
      detail.thumbnailUrl = thumbnailUrl;
    }
    return detail;
  } catch {
    return null;
  }
}

export function guardPois(raw: unknown): GuardedPois {
  try {
    if (!Array.isArray(raw)) return { items: [], dropped: 0 };

    const items: Poi[] = [];
    let dropped = 0;
    for (const item of raw) {
      const poi = assertPoi(item);
      if (poi === null) {
        dropped += 1;
      } else {
        items.push(poi);
      }
    }
    return { items, dropped };
  } catch {
    return { items: [], dropped: 0 };
  }
}

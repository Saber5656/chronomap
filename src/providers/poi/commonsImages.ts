import { WIKIMEDIA_IMG_HOSTS } from "../../security/hosts";
import { assertLatLng, httpsUrl } from "../../security/validate";
import { cachedFetch } from "./wikimediaClient";
import type { FetchImpl } from "./wikimediaClient";
import type { Poi, PoiProviderError } from "./types";

export const COMMONS_PHOTO_RADIUS_M = 500;
export const COMMONS_PHOTO_LIMIT = 10;
export const COMMONS_GEOSEARCH_LIMIT = 20;

const COMMONS_HOST = "commons.wikimedia.org";
const COMMONS_PAGE_HOSTS = new Set([COMMONS_HOST]);

type UnknownRecord = Record<string, unknown>;

export interface CommonsImage {
  readonly id: string;
  readonly title: string;
  readonly thumbUrl: string;
  readonly pageUrl: string;
  readonly year: number;
}

export interface CommonsImagesFetchOptions {
  readonly signal?: AbortSignal;
  readonly fetchImpl?: FetchImpl;
}

export interface CommonsPhotoProvider {
  fetch(poi: Poi, options?: CommonsImagesFetchOptions): Promise<readonly CommonsImage[]>;
}

class CommonsProviderException extends Error implements PoiProviderError {
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

function malformedError(): CommonsProviderException {
  return new CommonsProviderException("malformed");
}

function abortedError(): CommonsProviderException {
  return new CommonsProviderException("aborted");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortedError();
}

function coordinate(value: number): string {
  return value.toFixed(6);
}

function cacheCoordinate(value: number): string {
  const rounded = Math.round(value * 1_000) / 1_000;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(3);
}

function cacheKey(lat: number, lng: number): string {
  return `commons:${cacheCoordinate(lat)}:${cacheCoordinate(lng)}`;
}

function commonsApiUrl(params: Readonly<Record<string, string>>): URL {
  const url = new URL(`https://${COMMONS_HOST}/w/api.php`);
  const search = new URLSearchParams(params);
  search.set("format", "json");
  search.set("origin", "*");
  url.search = search.toString();
  return url;
}

function geosearchUrl(lat: number, lng: number): URL {
  return commonsApiUrl({
    action: "query",
    list: "geosearch",
    gscoord: `${coordinate(lat)}|${coordinate(lng)}`,
    gsradius: String(COMMONS_PHOTO_RADIUS_M),
    gslimit: String(COMMONS_GEOSEARCH_LIMIT),
    gsnamespace: "6",
  });
}

function imageInfoUrl(titles: readonly string[]): URL {
  return commonsApiUrl({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "320",
    titles: titles.join("|"),
  });
}

function geosearchTitles(value: unknown): readonly string[] {
  if (!isRecord(value) || "error" in value) throw malformedError();
  const query = value.query;
  if (query === undefined) return [];
  if (!isRecord(query) || !Array.isArray(query.geosearch)) throw malformedError();

  return query.geosearch.flatMap((item) => {
    if (!isRecord(item) || typeof item.title !== "string" || item.title.trim() === "") return [];
    if (item.ns !== undefined && item.ns !== 6) return [];
    return [item.title];
  });
}

/** Read a Commons date prefix without accepting arbitrary metadata or future formats. */
export function parseCommonsYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const match =
    /^(?:([0-9]{4})(?:-[0-9]{1,2}-[0-9]{1,2})?(?=$|[\s,TP<])|[0-9]{1,2}\s+[A-Za-z]+\s+([0-9]{4}))/u.exec(
      normalized,
    );
  const year = match === null ? null : Number(match[1] ?? match[2]);
  return year !== null && Number.isInteger(year) && year >= 1 && year < 1990 ? year : null;
}

function imageInfoPages(value: unknown): readonly UnknownRecord[] {
  if (!isRecord(value) || "error" in value) throw malformedError();
  const query = value.query;
  if (!isRecord(query) || !isRecord(query.pages)) throw malformedError();
  return Object.values(query.pages).flatMap((page) => (isRecord(page) ? [page] : []));
}

function mapImage(page: UnknownRecord): CommonsImage | null {
  const title = typeof page.title === "string" ? page.title : null;
  const pageid = page.pageid;
  const imageInfoValues: readonly unknown[] = Array.isArray(page.imageinfo) ? page.imageinfo : [];
  const imageInfo = imageInfoValues[0];
  if (
    title === null ||
    !isRecord(imageInfo) ||
    (page.ns !== undefined && page.ns !== 6) ||
    (typeof pageid !== "number" && typeof pageid !== "string")
  ) {
    return null;
  }

  const metadata = isRecord(imageInfo.extmetadata) ? imageInfo.extmetadata : undefined;
  const dateValue = isRecord(metadata?.DateTimeOriginal)
    ? metadata.DateTimeOriginal.value
    : undefined;
  const year = parseCommonsYear(dateValue);
  const thumbUrl = httpsUrl(imageInfo.thumburl, WIKIMEDIA_IMG_HOSTS);
  const pageUrl = httpsUrl(imageInfo.descriptionurl, COMMONS_PAGE_HOSTS);
  if (year === null || thumbUrl === null || pageUrl === null) return null;

  return {
    id: `commons:${String(pageid)}`,
    title,
    thumbUrl,
    pageUrl,
    year,
  };
}

async function fetchCommonsImages(
  poi: Poi,
  options: CommonsImagesFetchOptions = {},
): Promise<readonly CommonsImage[]> {
  let coordinates: { lat: number; lng: number };
  try {
    coordinates = assertLatLng(poi.lat, poi.lng);
  } catch {
    throw malformedError();
  }

  throwIfAborted(options.signal);
  const key = cacheKey(coordinates.lat, coordinates.lng);
  const searchResponse = await cachedFetch(
    key,
    geosearchUrl(coordinates.lat, coordinates.lng),
    options,
  );
  throwIfAborted(options.signal);
  const titles = geosearchTitles(searchResponse).slice(0, COMMONS_GEOSEARCH_LIMIT);
  if (titles.length === 0) return [];

  const imageResponse = await cachedFetch(
    `${key}:images:${titles.join("|")}`,
    imageInfoUrl(titles),
    options,
  );
  throwIfAborted(options.signal);
  const images = imageInfoPages(imageResponse).flatMap((page) => {
    const image = mapImage(page);
    return image === null ? [] : [image];
  });
  const unique = new Map<string, CommonsImage>();
  for (const image of images) unique.set(image.id, image);
  return [...unique.values()].slice(0, COMMONS_PHOTO_LIMIT);
}

export const commonsPhotoProvider: CommonsPhotoProvider = {
  fetch: fetchCommonsImages,
};

/** Exposed for registry consumers while keeping the provider implementation DOM-free. */
export function getCommonsPhotoProvider(): CommonsPhotoProvider {
  return commonsPhotoProvider;
}

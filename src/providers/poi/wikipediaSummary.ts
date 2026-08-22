import { WIKIMEDIA_IMG_HOSTS } from "../../security/hosts";
import { httpsUrl } from "../../security/validate";
import { assertPoiDetail } from "./guards";
import { cachedFetch } from "./wikimediaClient";
import type { FetchImpl } from "./wikimediaClient";
import { isWikipediaLanguage } from "./wikipediaGeosearch";
import type { WikipediaLanguage } from "./wikipediaGeosearch";
import type { Poi, PoiDetail, PoiProviderError } from "./types";

const WIKIPEDIA_HOSTS: Record<WikipediaLanguage, string> = {
  ja: "ja.wikipedia.org",
  en: "en.wikipedia.org",
};

type UnknownRecord = Record<string, unknown>;

export interface WikipediaSummaryFetchOptions {
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
}

class WikipediaSummaryException extends Error implements PoiProviderError {
  readonly kind: PoiProviderError["kind"];

  constructor() {
    super("malformed");
    this.name = "PoiProviderError";
    this.kind = "malformed";
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformedError(): WikipediaSummaryException {
  return new WikipediaSummaryException();
}

function pageHosts(lang: WikipediaLanguage): ReadonlySet<string> {
  return new Set([WIKIPEDIA_HOSTS[lang]]);
}

function safeUrl(value: unknown, allowedHosts: ReadonlySet<string>): string | undefined {
  return httpsUrl(value, allowedHosts) ?? undefined;
}

function buildSummaryUrl(lang: WikipediaLanguage, title: string): URL {
  try {
    const normalizedTitle = title.replaceAll(" ", "_");
    const encodedTitle = encodeURIComponent(normalizedTitle);
    return new URL(`https://${WIKIPEDIA_HOSTS[lang]}/api/rest_v1/page/summary/${encodedTitle}`);
  } catch {
    // encodeURIComponent rejects unpaired UTF-16 surrogates. Keep the provider contract typed
    // instead of leaking a raw URIError from untrusted GeoSearch data.
    throw malformedError();
  }
}

function summaryCacheKey(lang: WikipediaLanguage, title: string): string {
  return `summary:${lang}:${title}`;
}

function detailFromSummary(value: unknown, poi: Poi, lang: WikipediaLanguage): PoiDetail {
  if (!isRecord(value)) throw malformedError();

  const thumbnail = isRecord(value.thumbnail) ? value.thumbnail : undefined;
  const contentUrls = isRecord(value.content_urls) ? value.content_urls : undefined;
  const desktop =
    contentUrls !== undefined && isRecord(contentUrls.desktop) ? contentUrls.desktop : undefined;
  const hosts = pageHosts(lang);
  const pageUrl = safeUrl(desktop?.page, hosts) ?? safeUrl(poi.source.url, hosts);
  const thumbnailUrl = safeUrl(thumbnail?.source, WIKIMEDIA_IMG_HOSTS);

  // REST responses provide a roughly 320px thumbnail for the sheet; retain its source URL
  // verbatim instead of rewriting it with sizing parameters so the host allowlist stays strict.
  const guarded = assertPoiDetail({
    extract: value.extract,
    ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    pageUrl,
    attributionKey: "wikipedia-ccbysa",
  });
  if (guarded === null) throw malformedError();
  return guarded;
}

/** Fetch and guard the REST v1 summary for a Wikipedia POI. */
export async function fetchPoiDetail(
  poi: Poi,
  opts: WikipediaSummaryFetchOptions = {},
): Promise<PoiDetail> {
  if (poi.source.provider !== "wikipedia" || !isWikipediaLanguage(poi.source.lang)) {
    throw malformedError();
  }

  const lang = poi.source.lang;
  const response = await cachedFetch(
    summaryCacheKey(lang, poi.title),
    buildSummaryUrl(lang, poi.title),
    opts,
  );
  return detailFromSummary(response, poi, lang);
}

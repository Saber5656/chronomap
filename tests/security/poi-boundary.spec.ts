import { afterEach, describe, expect, it, vi } from "vitest";

import hostileGeosearchJson from "./fixtures/poi/hostile-geosearch.json";
import hostileSummaryJson from "./fixtures/poi/hostile-summary.json";
import {
  assertPoi,
  assertPoiDetail,
  clearWikimediaCache,
  createWikipediaProvider,
  fetchPoiDetail,
  guardPois,
} from "../../src/providers/poi";
import type { Poi } from "../../src/providers/poi/types";

type UnknownRecord = Record<string, unknown>;

const HOSTILE_GEOSEARCH = hostileGeosearchJson as {
  readonly query: { readonly geosearch: readonly unknown[] };
};

const response = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function stubFetch(body: unknown): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(body));
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
}

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "wikipedia-ja:900001",
    title: "Hostile article",
    lat: 35.681236,
    lng: 139.767125,
    source: {
      provider: "wikipedia",
      lang: "ja",
      url: "https://ja.wikipedia.org/?curid=900001",
    },
    ...overrides,
  };
}

afterEach(() => {
  clearWikimediaCache();
  vi.unstubAllGlobals();
});

describe("security abuse boundary: Wikimedia providers", () => {
  it("A5 truncates hostile extracts, ignores extract_html, and drops evil thumbnail URLs", async () => {
    const fetchImpl = stubFetch({
      ...(hostileSummaryJson as UnknownRecord),
      extract: "x".repeat(100_000),
    });

    const result = await fetchPoiDetail(poi(), { fetchImpl });

    expect([...result.extract]).toHaveLength(1_200);
    expect(result.extract).toBe(`${"x".repeat(1_199)}…`);
    expect(result).toEqual({
      extract: `${"x".repeat(1_199)}…`,
      pageUrl: "https://ja.wikipedia.org/?curid=900001",
      attributionKey: "wikipedia-ccbysa",
    });
    expect(result).not.toHaveProperty("extract_html");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("A5 rejects unvalidated detail payloads at the guard boundary", () => {
    const guarded = assertPoiDetail({
      extract: "<script>alert(1)</script>",
      thumbnailUrl: "https://evil.example/tracking.png",
      pageUrl: "https://ja.wikipedia.org/wiki/Safe",
      attributionKey: "wikipedia-ccbysa",
      extract_html: "<script>alert(2)</script>",
    });

    expect(guarded).toBeNull();
  });

  it("A5 guards every item before limiting a 1000-item geosearch response", async () => {
    const fixtureItems = HOSTILE_GEOSEARCH.query.geosearch;
    const validTemplate = fixtureItems[0] as UnknownRecord;
    const items = Array.from({ length: 1_000 }, (_, index) => {
      if (index < fixtureItems.length) return fixtureItems[index];

      const valid = {
        ...validTemplate,
        pageid: 901_000 + index,
        title: `記事 ${index}`,
        dist: index,
      };
      if (index % 5 === 0) return { ...valid, pageid: String(valid.pageid) };
      if (index % 7 === 0) return { ...valid, dist: -1 };
      if (index % 11 === 0) return { ...valid, ns: 6 };
      if (index % 13 === 0) return { ...valid, lat: "35.681236" };
      return valid;
    });
    const fetchImpl = stubFetch({ batchcomplete: "", query: { geosearch: items } });

    const result = await createWikipediaProvider("ja").search({
      lat: 35.681236,
      lng: 139.767125,
      radiusM: 5_000,
      locale: "ja",
      signal: new AbortController().signal,
    });

    expect(items).toHaveLength(1_000);
    expect(result).toHaveLength(50);
    expect(result.every((item) => assertPoi(item) !== null)).toBe(true);
    expect(result.every((item) => item.source.url.startsWith("https://ja.wikipedia.org/"))).toBe(
      true,
    );
    expect(fetchImpl).toHaveBeenCalledOnce();

    const first = result[0];
    if (first === undefined) throw new Error("Expected a guarded POI.");
    const audit = guardPois([
      first,
      null,
      { ...first, title: 42 },
      { ...first, source: { ...first.source, url: "https://evil.example/" } },
    ]);
    expect(audit.items).toEqual([first]);
    expect(audit.dropped).toBe(3);
    expect(audit.items.every((item) => assertPoi(item) !== null)).toBe(true);
  });
});

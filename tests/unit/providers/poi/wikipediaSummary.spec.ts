import { afterEach, describe, expect, it, vi } from "vitest";

import disambiguationSummary from "../../fixtures/poi/summary-disambiguation.json";
import maliciousSummary from "../../fixtures/poi/summary-malicious.json";
import noThumbnailSummary from "../../fixtures/poi/summary-no-thumbnail.json";
import summary from "../../fixtures/poi/summary.json";
import { clearWikimediaCache, fetchPoiDetail } from "../../../../src/providers/poi";
import { fetchPoiDetail as directFetchPoiDetail } from "../../../../src/providers/poi/wikipediaSummary";
import type { Poi } from "../../../../src/providers/poi/types";

function response(body: unknown, options: { ok?: boolean; status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...(options.ok === undefined ? {} : { statusText: options.ok ? "OK" : "Error" }),
  });
}

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "wikipedia-ja:100001",
    title: "東京駅",
    lat: 35.681236,
    lng: 139.767125,
    distanceM: 12.5,
    source: {
      provider: "wikipedia",
      lang: "ja",
      url: "https://ja.wikipedia.org/?curid=100001",
    },
    ...overrides,
  };
}

function stubFetch(body: unknown): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(body));
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
}

function requestedUrl(fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>): string {
  const input = fetchImpl.mock.calls[0]?.[0];
  if (input instanceof URL) return input.href;
  if (typeof input === "string") return input;
  return input?.url ?? "";
}

afterEach(() => {
  clearWikimediaCache();
  vi.unstubAllGlobals();
});

describe("fetchPoiDetail", () => {
  it.each([
    ["spaces", "Tokyo Station", "Tokyo_Station"],
    ["Japanese", "東京駅", "%E6%9D%B1%E4%BA%AC%E9%A7%85"],
    ["slashes", "AC/DC", "AC%2FDC"],
  ])("encodes %s in the REST summary URL", async (_caseName, title, encodedTitle) => {
    const fetchImpl = stubFetch(summary);

    await fetchPoiDetail(
      poi({
        title,
        source: { provider: "wikipedia", lang: "ja", url: "https://ja.wikipedia.org/?curid=1" },
      }),
      { fetchImpl },
    );

    expect(requestedUrl(fetchImpl)).toBe(
      `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`,
    );
  });

  it("maps the plain extract and allowlisted thumbnail/page URLs through the detail guard", async () => {
    const fetchImpl = stubFetch(summary);

    await expect(fetchPoiDetail(poi(), { fetchImpl })).resolves.toEqual({
      extract: "東京駅は、東京都千代田区丸の内にある鉄道駅です。",
      thumbnailUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg/320px-example.jpg",
      pageUrl: "https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E9%A7%85",
      attributionKey: "wikipedia-ccbysa",
    });
  });

  it("drops an unsafe thumbnail and falls back from an unsafe desktop page to the POI URL", async () => {
    const fetchImpl = stubFetch(noThumbnailSummary);

    await expect(
      fetchPoiDetail(
        poi({
          title: "Tokyo Station",
          source: {
            provider: "wikipedia",
            lang: "en",
            url: "https://en.wikipedia.org/?curid=100001",
          },
        }),
        { fetchImpl },
      ),
    ).resolves.toEqual({
      extract: "Tokyo Station is a railway station in Tokyo, Japan.",
      pageUrl: "https://en.wikipedia.org/?curid=100001",
      attributionKey: "wikipedia-ccbysa",
    });
  });

  it("keeps a disambiguation extract because the type field is not rendered as HTML", async () => {
    stubFetch(disambiguationSummary);

    await expect(
      fetchPoiDetail(
        poi({
          id: "wikipedia-en:1",
          title: "Mercury",
          source: {
            provider: "wikipedia",
            lang: "en",
            url: "https://en.wikipedia.org/wiki/Mercury",
          },
        }),
      ),
    ).resolves.toMatchObject({
      extract: "Mercury may refer to several subjects, including a planet and an element.",
      pageUrl: "https://en.wikipedia.org/wiki/Mercury",
    });
  });

  it("preserves HTML-looking plain text and ignores extract_html", async () => {
    stubFetch(maliciousSummary);

    await expect(
      fetchPoiDetail(
        poi({
          title: "Unsafe article",
          source: { provider: "wikipedia", lang: "ja", url: "https://ja.wikipedia.org/?curid=2" },
        }),
      ),
    ).resolves.toEqual({
      extract: "<script>alert('not executable')</script> This remains plain text.",
      pageUrl: "https://ja.wikipedia.org/?curid=2",
      attributionKey: "wikipedia-ccbysa",
    });
  });

  it("truncates an oversized plain extract to exactly 1200 code points including the ellipsis", async () => {
    const fetchImpl = stubFetch({
      ...summary,
      extract: "x".repeat(100_000),
    });

    const result = await fetchPoiDetail(poi(), { fetchImpl });

    expect([...result.extract]).toHaveLength(1_200);
    expect(result.extract).toBe(`${"x".repeat(1_199)}…`);
  });

  it("uses the POI URL when the response omits optional nested URL fields", async () => {
    const fetchImpl = stubFetch({ extract: "Only a plain extract." });

    await expect(fetchPoiDetail(poi(), { fetchImpl })).resolves.toEqual({
      extract: "Only a plain extract.",
      pageUrl: "https://ja.wikipedia.org/?curid=100001",
      attributionKey: "wikipedia-ccbysa",
    });
  });

  it("rejects a non-object summary as a typed malformed provider error", async () => {
    const fetchImpl = stubFetch(null);

    await expect(fetchPoiDetail(poi(), { fetchImpl })).rejects.toMatchObject({
      kind: "malformed",
    });
  });

  it("propagates a Wikimedia 404 as the typed HTTP provider error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ title: "Not found" }, { ok: false, status: 404 }));

    await expect(fetchPoiDetail(poi(), { fetchImpl })).rejects.toMatchObject({
      kind: "http",
      status: 404,
    });
  });

  it("propagates malformed summary data as a typed provider error", async () => {
    const fetchImpl = stubFetch({ ...summary, extract: undefined });

    await expect(fetchPoiDetail(poi(), { fetchImpl })).rejects.toMatchObject({
      kind: "malformed",
    });
  });

  it("rejects a non-Wikipedia POI before making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      fetchPoiDetail(
        poi({
          source: { provider: "commons", lang: "en", url: "https://commons.wikimedia.org/" },
        }),
        { fetchImpl },
      ),
    ).rejects.toMatchObject({ kind: "malformed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the summary cache for repeated requests with the same language and title", async () => {
    const fetchImpl = stubFetch(summary);
    const selected = poi();

    await fetchPoiDetail(selected, { fetchImpl });
    await fetchPoiDetail(selected, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("exports the detail API from the provider barrel", () => {
    expect(fetchPoiDetail).toBe(directFetchPoiDetail);
  });
});

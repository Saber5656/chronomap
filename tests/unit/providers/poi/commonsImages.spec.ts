import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commonsPhotoProvider,
  COMMONS_PHOTO_LIMIT,
  parseCommonsYear,
} from "../../../../src/providers/poi/commonsImages";
import { clearWikimediaCache } from "../../../../src/providers/poi/wikimediaClient";
import type { Poi } from "../../../../src/providers/poi/types";

describe("parseCommonsYear", () => {
  it.each([
    ["1900", 1900],
    ["1900-01-02", 1900],
    ["1900-01-02T00:00:00Z", 1900],
    ['1889<div class="wb-external-id">', 1889],
    ["2 January 1900", 1900],
    ["12 September 1989, description", 1989],
  ])("accepts %s", (value, expected) => {
    expect(parseCommonsYear(value)).toBe(expected);
  });

  it.each(["1990", "2026", "not a date", "January 1900", "1900/01/02", ""])("drops %s", (value) => {
    expect(parseCommonsYear(value)).toBeNull();
  });
});

describe("Commons photo provider", () => {
  afterEach(() => {
    clearWikimediaCache();
    vi.unstubAllGlobals();
  });

  it("fetches, filters, guards, caches, and caps old Commons images", async () => {
    const pages = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => [
        String(987654 + index),
        {
          pageid: 987654 + index,
          ns: 6,
          title: `File:Old ${index}.jpg`,
          imageinfo: [
            {
              thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/${index}/old.jpg`,
              descriptionurl: `https://commons.wikimedia.org/wiki/File:Old_${index}.jpg`,
              extmetadata: {
                DateTimeOriginal: { value: `19${index.toString().padStart(2, "0")}` },
              },
            },
          ],
        },
      ]),
    );
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url =
        input instanceof URL
          ? input
          : typeof input === "string"
            ? new URL(input)
            : new URL(input.url);
      if (url.searchParams.get("list") === "geosearch") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              query: {
                geosearch: Object.values(pages).map((page) => ({
                  ns: 6,
                  title: page.title,
                })),
              },
            }),
            { headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ query: { pages } }), {
          headers: { "content-type": "application/json" },
        }),
      );
    });
    const poi: Poi = {
      id: "wikipedia-ja:123",
      title: "大阪城",
      lat: 34.687315,
      lng: 135.526201,
      source: {
        provider: "wikipedia",
        lang: "ja",
        url: "https://ja.wikipedia.org/?curid=123",
      },
    };

    const first = await commonsPhotoProvider.fetch(poi, { fetchImpl });
    const second = await commonsPhotoProvider.fetch(poi, { fetchImpl });

    expect(first).toHaveLength(COMMONS_PHOTO_LIMIT);
    expect(first).toEqual(second);
    expect(first[0]?.year).toBe(1900);
    expect(first[0]?.pageUrl).toContain("commons.wikimedia.org");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const requestUrl = (input: RequestInfo | URL): URL =>
      input instanceof URL
        ? input
        : typeof input === "string"
          ? new URL(input)
          : new URL(input.url);
    const searchUrl = requestUrl(fetchImpl.mock.calls[0]?.[0] ?? "https://example.test");
    const imageUrl = requestUrl(fetchImpl.mock.calls[1]?.[0] ?? "https://example.test");
    expect(searchUrl.searchParams.get("gsnamespace")).toBe("6");
    expect(searchUrl.searchParams.get("gsradius")).toBe("500");
    expect(searchUrl.searchParams.get("gslimit")).toBe("20");
    expect(imageUrl.searchParams.get("iiurlwidth")).toBe("320");
    expect(imageUrl.searchParams.get("titles")).toContain("File:Old 0.jpg");
  });

  it("does not publish a cached response after the caller aborts", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ query: { geosearch: [] } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const poi: Poi = {
      id: "wikipedia-ja:123",
      title: "大阪城",
      lat: 34.687315,
      lng: 135.526201,
      source: { provider: "wikipedia", lang: "ja", url: "https://ja.wikipedia.org/?curid=123" },
    };
    const controller = new AbortController();
    await commonsPhotoProvider.fetch(poi, { fetchImpl });
    controller.abort();

    await expect(
      commonsPhotoProvider.fetch(poi, { fetchImpl, signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: "aborted",
    });
  });
});

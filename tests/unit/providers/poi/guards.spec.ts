import { describe, expect, it } from "vitest";

import detailFixture from "../../fixtures/poi/detail.json";
import malformedFixtures from "../../fixtures/poi/malformed.json";
import poiFixtures from "../../fixtures/poi/valid.json";
import { assertPoi, assertPoiDetail, guardPois } from "../../../../src/providers/poi/guards";

type UnknownRecord = Record<string, unknown>;

const validPoiFixture = poiFixtures[0] as UnknownRecord;
const validDetailFixture = detailFixture as UnknownRecord;

function poi(overrides: UnknownRecord = {}): UnknownRecord {
  const source = validPoiFixture.source as UnknownRecord;
  return {
    ...validPoiFixture,
    source: { ...source },
    ...overrides,
  };
}

function detail(overrides: UnknownRecord = {}): UnknownRecord {
  return { ...validDetailFixture, ...overrides };
}

describe("assertPoi", () => {
  it("accepts the fixture, normalizes text and coordinates, and omits Wikipedia-specific fields", () => {
    const raw = poi({ pageid: 12345 });
    const result = assertPoi(raw);

    expect(result).toEqual({
      id: "wikipedia-ja:12345",
      title: "東京駅",
      lat: 35.681237,
      lng: 139.767125,
      distanceM: 12.5,
      source: {
        provider: "wikipedia",
        lang: "ja",
        url: "https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E9%A7%85",
      },
    });
    expect(result).not.toHaveProperty("pageid");
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing id", poi({ id: undefined })],
    ["blank id", poi({ id: "  " })],
    ["missing title", poi({ title: undefined })],
    ["missing latitude", poi({ lat: undefined })],
    ["missing longitude", poi({ lng: undefined })],
    ["missing source", poi({ source: undefined })],
  ])("rejects %s", (_name, raw) => {
    expect(assertPoi(raw)).toBeNull();
  });

  it.each([
    ["NaN latitude", poi({ lat: Number.NaN })],
    ["infinite longitude", poi({ lng: Number.POSITIVE_INFINITY })],
    ["non-number latitude", poi({ lat: "35.6" })],
    ["title at 301 code points", poi({ title: "a".repeat(301) })],
    ["non-finite distance", poi({ distanceM: Number.NaN })],
    ["negative distance", poi({ distanceM: -1 })],
    [
      "http page URL",
      poi({ source: { provider: "wikipedia", lang: "ja", url: "http://ja.wikipedia.org/" } }),
    ],
    [
      "foreign page host",
      poi({ source: { provider: "wikipedia", lang: "ja", url: "https://evil.example/" } }),
    ],
    [
      "language and host mismatch",
      poi({ source: { provider: "wikipedia", lang: "ja", url: "https://en.wikipedia.org/" } }),
    ],
    [
      "credential-bearing page URL",
      poi({
        source: { provider: "wikipedia", lang: "ja", url: "https://user:pass@ja.wikipedia.org/" },
      }),
    ],
    [
      "alternate page port",
      poi({ source: { provider: "wikipedia", lang: "ja", url: "https://ja.wikipedia.org:8443/" } }),
    ],
    [
      "blank source language",
      poi({ source: { provider: "wikipedia", lang: " ", url: "https://ja.wikipedia.org/" } }),
    ],
    [
      "unsupported Wikipedia language",
      poi({ source: { provider: "wikipedia", lang: "fr", url: "https://fr.wikipedia.org/" } }),
    ],
    [
      "unsupported Commons language",
      poi({ source: { provider: "commons", lang: "fr", url: "https://commons.wikimedia.org/" } }),
    ],
    [
      "invalid Commons page URL",
      poi({ source: { provider: "commons", lang: "en", url: "https://evil.example/" } }),
    ],
  ])("rejects %s", (_name, raw) => {
    expect(assertPoi(raw)).toBeNull();
  });

  it("clamps finite out-of-range coordinates and accepts a missing optional distance", () => {
    const result = assertPoi(poi({ lat: 91, lng: -181, distanceM: undefined }));

    expect(result).toMatchObject({ lat: 90, lng: -180 });
    expect(result).not.toHaveProperty("distanceM");
  });

  it("accepts a Commons source with the Commons page host", () => {
    const commonsFixture = poiFixtures[2];
    if (commonsFixture === undefined) throw new Error("Missing Commons fixture");
    const result = assertPoi(poi({ ...commonsFixture, source: { ...commonsFixture.source } }));

    expect(result?.source).toEqual({
      provider: "commons",
      lang: "en",
      url: "https://commons.wikimedia.org/wiki/File:Station.jpg",
    });
  });

  it("does not mutate the raw item", () => {
    const raw = poi();
    const before = JSON.stringify(raw);

    expect(assertPoi(raw)).not.toBeNull();
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe("assertPoiDetail", () => {
  it("rejects primitive input without throwing", () => {
    expect(assertPoiDetail(null)).toBeNull();
    expect(assertPoiDetail("detail")).toBeNull();
  });

  it("accepts the fixture and uses only the plain-text extract", () => {
    expect(assertPoiDetail(detail())).toEqual({
      extract: "Tokyo Station is a railway station in Tokyo, Japan.",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg",
      pageUrl: "https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E9%A7%85",
      attributionKey: "wikipedia-ccbysa",
    });
  });

  it("normalizes and truncates long extracts to 1200 code points", () => {
    const result = assertPoiDetail(detail({ extract: ` e\u0301${"a".repeat(1_200)} ` }));

    expect(result?.extract.startsWith("éa")).toBe(true);
    expect([...(result?.extract ?? "")]).toHaveLength(1_200);
    expect(result?.extract.endsWith("…")).toBe(true);
  });

  it("accepts a detail without a thumbnail", () => {
    const result = assertPoiDetail(detail({ thumbnailUrl: undefined }));

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("thumbnailUrl");
  });

  it.each([
    ["missing extract", detail({ extract: undefined })],
    ["missing page URL", detail({ pageUrl: undefined })],
    ["wrong attribution", detail({ attributionKey: "other" })],
    ["HTTP page URL", detail({ pageUrl: "http://ja.wikipedia.org/" })],
    ["foreign page host", detail({ pageUrl: "https://evil.example/" })],
    ["credential-bearing page URL", detail({ pageUrl: "https://user:pass@ja.wikipedia.org/" })],
    ["alternate page port", detail({ pageUrl: "https://ja.wikipedia.org:8443/" })],
    ["foreign thumbnail host", detail({ thumbnailUrl: "https://evil.example/image.jpg" })],
    ["HTTP thumbnail", detail({ thumbnailUrl: "http://upload.wikimedia.org/image.jpg" })],
    [
      "credential-bearing thumbnail",
      detail({ thumbnailUrl: "https://user:pass@upload.wikimedia.org/image.jpg" }),
    ],
    [
      "alternate thumbnail port",
      detail({ thumbnailUrl: "https://upload.wikimedia.org:8443/image.jpg" }),
    ],
    ["null thumbnail", detail({ thumbnailUrl: null })],
  ])("rejects %s", (_name, raw) => {
    expect(assertPoiDetail(raw)).toBeNull();
  });

  it("does not mutate the raw detail", () => {
    const raw = detail();
    const before = JSON.stringify(raw);

    expect(assertPoiDetail(raw)).not.toBeNull();
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe("guardPois", () => {
  it("drops malformed items, preserves valid order, and reports the drop count", () => {
    const raw = [poi({ id: "first" }), ...malformedFixtures, poi({ id: "last" })];

    expect(guardPois(raw)).toEqual({
      items: [expect.objectContaining({ id: "first" }), expect.objectContaining({ id: "last" })],
      dropped: malformedFixtures.length,
    });
  });

  it("returns an empty result for a malformed list envelope", () => {
    expect(guardPois(null)).toEqual({ items: [], dropped: 0 });
    expect(guardPois({ items: [] })).toEqual({ items: [], dropped: 0 });
  });

  it("never throws for an item whose property access throws", () => {
    const raw = Object.create(null) as UnknownRecord;
    Object.defineProperty(raw, "title", {
      get() {
        throw new Error("malformed input");
      },
    });

    expect(() => assertPoi(raw)).not.toThrow();
    expect(assertPoi(raw)).toBeNull();
  });

  it("never throws when a detail property access throws", () => {
    const raw = Object.create(null) as UnknownRecord;
    Object.defineProperty(raw, "extract", {
      get() {
        throw new Error("malformed detail");
      },
    });

    expect(() => assertPoiDetail(raw)).not.toThrow();
    expect(assertPoiDetail(raw)).toBeNull();
  });

  it("never throws when the input list iterator is broken", () => {
    const raw = new Proxy<unknown[]>([], {
      get(target, property, receiver) {
        if (property === Symbol.iterator) throw new Error("malformed list");
        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    expect(() => guardPois(raw)).not.toThrow();
    expect(guardPois(raw)).toEqual({ items: [], dropped: 0 });
  });
});

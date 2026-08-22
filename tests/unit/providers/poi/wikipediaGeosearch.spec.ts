import { afterEach, describe, expect, it, vi } from "vitest";

import malformedGeosearch from "../../fixtures/poi/geosearch-malformed.json";
import tokyoGeosearch from "../../fixtures/poi/geosearch-tokyo.json";
import {
  clearWikimediaCache,
  getPoiProvider,
  latestOnly,
  createWikipediaProvider,
} from "../../../../src/providers/poi";
import type { PoiProvider } from "../../../../src/providers/poi/types";

const response = (body: unknown, options: { ok?: boolean; status?: number } = {}): Response =>
  new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...(options.ok === undefined ? {} : { statusText: options.ok ? "OK" : "Error" }),
  });

function query(
  overrides: Partial<{
    lat: number;
    lng: number;
    radiusM: number;
    locale: "ja" | "en";
    signal: AbortSignal;
  }> = {},
): Parameters<PoiProvider["search"]>[0] {
  return {
    lat: 35.681236,
    lng: 139.767125,
    radiusM: 5_000,
    locale: "ja",
    signal: new AbortController().signal,
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createWikipediaProvider", () => {
  it("constructs the exact locale endpoint with stable URLSearchParams order", async () => {
    const fetchImpl = stubFetch(tokyoGeosearch);
    const provider = createWikipediaProvider("ja");

    await provider.search(query({ lat: 35.681234567, lng: 139.767125432, radiusM: 1_234.6 }));

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(requestedUrl(fetchImpl)).toBe(
      "https://ja.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=35.681235%7C139.767125&gsradius=1235&gslimit=50&gsnamespace=0&format=json&origin=*",
    );
  });

  it("maps the Tokyo fixture through the guards without sorting", async () => {
    stubFetch(tokyoGeosearch);
    const result = await createWikipediaProvider("ja").search(query());

    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({
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
    });
    expect(result.map((item) => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `wikipedia-ja:${100001 + index}`),
    );
    expect(result[19]?.source.url).toBe("https://ja.wikipedia.org/?curid=100020");
  });

  it.each([
    ["missing query", { batchcomplete: "" }],
    ["missing geosearch", { batchcomplete: "", query: {} }],
  ])("treats %s as an empty result", async (_name, body) => {
    stubFetch(body);

    await expect(createWikipediaProvider("ja").search(query())).resolves.toEqual([]);
  });

  it("rejects a MediaWiki API error envelope as a typed malformed error", async () => {
    stubFetch({ error: { code: "badrequest", info: "invalid query" } });

    await expect(createWikipediaProvider("ja").search(query())).rejects.toMatchObject({
      kind: "malformed",
    });
  });

  it("drops malformed items while preserving valid API order", async () => {
    stubFetch(malformedGeosearch);

    const result = await createWikipediaProvider("ja").search(query());

    expect(result.map((item) => item.id)).toEqual(["wikipedia-ja:200001", "wikipedia-ja:200007"]);
  });

  it("guards all results before applying the POI_MAX limit", async () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      pageid: 300000 + index,
      ns: 0,
      title: `記事 ${index}`,
      lat: 35.681236,
      lon: 139.767125,
      dist: index,
      primary: "",
    }));
    stubFetch({ batchcomplete: "", query: { geosearch: items } });

    const result = await createWikipediaProvider("ja").search(query());

    expect(result).toHaveLength(50);
    expect(result[0]?.id).toBe("wikipedia-ja:300000");
    expect(result.at(-1)?.id).toBe("wikipedia-ja:300049");
  });

  it("shares responses for identical rounded coordinates and radius buckets", async () => {
    const fetchImpl = stubFetch(tokyoGeosearch);
    const provider = createWikipediaProvider("ja");

    await provider.search(query({ lat: 35.68121, lng: 139.76721, radiusM: 1_234 }));
    await provider.search(query({ lat: 35.68124, lng: 139.76724, radiusM: 1_240 }));

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("clamps the outbound radius while rejecting invalid coordinates and languages", async () => {
    const fetchImpl = stubFetch(tokyoGeosearch);
    const provider = createWikipediaProvider("ja");

    await provider.search(query({ radiusM: 1 }));
    expect(requestedUrl(fetchImpl)).toContain("gsradius=100");

    await expect(provider.search(query({ lat: 91 }))).rejects.toMatchObject({ kind: "malformed" });
    await expect(provider.search(query({ locale: "en" }))).rejects.toMatchObject({
      kind: "malformed",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("propagates the Wikimedia client's oversized-body malformed error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("x".repeat(512 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    await expect(createWikipediaProvider("ja").search(query())).rejects.toMatchObject({
      kind: "malformed",
    });
  });

  it("propagates an aborted request as a typed provider error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    });
    vi.stubGlobal("fetch", fetchImpl);
    const controller = new AbortController();
    const pending = createWikipediaProvider("ja").search(query({ signal: controller.signal }));

    controller.abort();

    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });

  it("uses the client timeout when the provider request does not settle", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("timeout")), {
          once: true,
        });
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    const pending = createWikipediaProvider("ja").search(query());
    const expected = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(8_000);

    await expected;
  });

  it("can be composed with latestOnly so a newer search aborts the older one", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
        resolvers.push(resolve);
      });
    });
    vi.stubGlobal("fetch", fetchImpl);
    const provider = createWikipediaProvider("ja");
    const run = latestOnly((signal, request: Parameters<PoiProvider["search"]>[0]) =>
      provider.search({ ...request, signal }),
    );

    const first = run(query({ lat: 35.6811 }));
    const second = run(query({ lat: 35.6812 }));
    resolvers[1]?.(response(tokyoGeosearch));

    await expect(first).rejects.toMatchObject({ kind: "aborted" });
    await expect(second).resolves.toHaveLength(20);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("POI provider registry", () => {
  it("returns locale-bound Wikipedia providers", () => {
    expect(getPoiProvider("ja")).toMatchObject({ id: "wikipedia", minZoom: 13 });
    expect(getPoiProvider("en")).toMatchObject({ id: "wikipedia", minZoom: 13 });
    expect(getPoiProvider("ja")).not.toBe(getPoiProvider("en"));
  });
});

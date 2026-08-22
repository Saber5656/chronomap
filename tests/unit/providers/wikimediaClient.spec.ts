import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cachedFetch,
  clearWikimediaCache,
  latestOnly,
  wikimediaFetch,
} from "../../../src/providers/poi/wikimediaClient";

const API_URL = new URL("https://ja.wikipedia.org/w/api.php?action=query");

function response(
  body: string,
  options: { contentType?: string; ok?: boolean; status?: number } = {},
): Response {
  return new Response(body, {
    status: options.status ?? 200,
    headers: { "content-type": options.contentType ?? "application/json; charset=utf-8" },
  });
}

afterEach(() => {
  clearWikimediaCache();
  vi.useRealTimers();
});

describe("wikimediaFetch", () => {
  it("returns parsed JSON and sends the descriptive API user agent", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response('{"items":[1]}'));

    await expect(wikimediaFetch(API_URL, { fetchImpl })).resolves.toEqual({ items: [1] });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({
      "Api-User-Agent": "chronomap/0.0.0 (+https://github.com/Saber5656/chronomap)",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["non-JSON content type", response("{}", { contentType: "text/html" }), { kind: "malformed" }],
    ["HTTP failure", response("", { ok: false, status: 500 }), { kind: "http", status: 500 }],
    ["invalid JSON", response("not-json"), { kind: "malformed" }],
    ["oversized body", response("x".repeat(512 * 1024 + 1)), { kind: "malformed" }],
  ] as const)("normalizes %s", async (_name, fetchResponse, expected) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(fetchResponse);

    await expect(wikimediaFetch(API_URL, { fetchImpl })).rejects.toMatchObject(expected);
  });

  it("normalizes network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));

    await expect(wikimediaFetch(API_URL, { fetchImpl })).rejects.toMatchObject({ kind: "network" });
  });

  it("normalizes provider-shaped errors thrown by the fetch implementation", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue({
      kind: "http",
      status: 599,
    });

    await expect(wikimediaFetch(API_URL, { fetchImpl })).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("normalizes an external abort", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    });
    const pending = wikimediaFetch(API_URL, { fetchImpl, signal: controller.signal });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });

  it("normalizes the client timeout separately from an external abort", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("timeout")), {
          once: true,
        });
      });
    });

    const pending = wikimediaFetch(API_URL, { fetchImpl });
    const expected = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(8_000);

    await expected;
  });

  it("rejects a disallowed URL before invoking fetch", () => {
    const fetchImpl = vi.fn<typeof fetch>();

    expect(() => wikimediaFetch(new URL("https://evil.example/w/api.php"), { fetchImpl })).toThrow(
      Error,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("cachedFetch", () => {
  it("reuses a resolved response by cache key", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response('{"cached":true}'));

    await expect(cachedFetch("key", API_URL, { fetchImpl })).resolves.toEqual({ cached: true });
    await expect(cachedFetch("key", API_URL, { fetchImpl })).resolves.toEqual({ cached: true });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("shares an in-flight request and does not retain rejected requests", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const first = cachedFetch("in-flight", API_URL, { fetchImpl });
    const second = cachedFetch("in-flight", API_URL, { fetchImpl });
    expect(first).toBe(second);
    expect(fetchImpl).toHaveBeenCalledOnce();

    resolveResponse?.(response('{"ok":true}'));
    await expect(first).resolves.toEqual({ ok: true });

    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    await expect(cachedFetch("failed", API_URL, { fetchImpl: failingFetch })).rejects.toMatchObject(
      {
        kind: "network",
      },
    );
    const retryFetch = vi.fn<typeof fetch>().mockResolvedValue(response('{"retry":true}'));
    await expect(cachedFetch("failed", API_URL, { fetchImpl: retryFetch })).resolves.toEqual({
      retry: true,
    });
    expect(retryFetch).toHaveBeenCalledOnce();
  });

  it("does not reuse an aborted in-flight request for a latest-only call", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
          resolvers.push(resolve);
        }),
    );
    const run = latestOnly();

    const first = run((signal) => cachedFetch("latest", API_URL, { fetchImpl, signal }));
    const second = run((signal) => cachedFetch("latest", API_URL, { fetchImpl, signal }));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    resolvers[1]?.(response('{"latest":true}'));

    await expect(first).rejects.toMatchObject({ kind: "aborted" });
    await expect(second).resolves.toEqual({ latest: true });
  });
});

describe("latestOnly", () => {
  it("aborts the previous operation when a new operation starts", async () => {
    const run = latestOnly();
    let firstSignal: AbortSignal | undefined;
    let rejectFirst: ((reason?: unknown) => void) | undefined;
    const first = run((signal: AbortSignal) => {
      firstSignal = signal;
      return new Promise<string>((_resolve, reject) => {
        rejectFirst = reject;
      });
    });

    const second = run(() => Promise.resolve("second"));
    expect(firstSignal?.aborted).toBe(true);
    rejectFirst?.(new Error("cancelled"));

    await expect(first).rejects.toThrow("cancelled");
    await expect(second).resolves.toBe("second");
  });

  it("supports a reusable operation wrapper and preserves the latest result", async () => {
    const signals: AbortSignal[] = [];
    const run = latestOnly((signal: AbortSignal, value: string) => {
      signals.push(signal);
      return Promise.resolve(value);
    });

    await expect(run("result")).resolves.toBe("result");
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);
  });
});

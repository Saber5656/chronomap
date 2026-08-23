import { describe, expect, it, vi } from "vitest";

import {
  MAX_REQUESTS,
  SmokeError,
  USER_AGENT,
  main,
  renderTable,
  runSmoke,
} from "../../../scripts/smoke-providers.mjs";

function response(status, payload) {
  return {
    status,
    json: async () => payload,
  };
}

function layer(id) {
  return {
    id,
    coverage: [[139, 35, 140, 36]],
    tiles: {
      urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/test/{z}/{x}/{y}.png",
      scheme: "xyz",
      minzoom: 10,
    },
  };
}

describe("smoke:providers", () => {
  it("skips live requests in CI and prints a notice", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      await expect(main({ env: { CI: "true" }, stdout, stderr })).resolves.toBe(0);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(stdout).toHaveBeenCalledWith(expect.stringContaining("skipped"));
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("checks every supplied layer plus both Tokyo Station endpoints", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      if (fetchImpl.mock.calls.length === 2) {
        return response(200, { query: { geosearch: [{ pageid: 1 }] } });
      }
      if (fetchImpl.mock.calls.length === 3) {
        return response(200, { title: "Tokyo Station", extract: "A station." });
      }
      return response(200);
    });

    const result = await runSmoke({
      registries: [layer("layer-a")],
      fetchImpl,
      intervalMs: 0,
    });

    expect(result.requestCount).toBe(3);
    expect(result.rows.map(({ target }) => target)).toEqual([
      "layer-a",
      "Tokyo Station",
      "Tokyo Station",
    ]);
    expect(fetchImpl.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ "Api-User-Agent": USER_AGENT, "User-Agent": USER_AGENT }),
    );
    expect(renderTable(result.rows)).toContain("| Kind");
  });

  it("accepts a tile 404 as the documented coverage/no-data result", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(200, { query: { geosearch: [{ pageid: 1 }] } }))
      .mockResolvedValueOnce(response(200, { title: "Tokyo Station", extract: "A station." }));

    const result = await runSmoke({
      registries: [layer("layer-404")],
      fetchImpl,
      intervalMs: 0,
    });

    expect(result.rows[0]).toEqual(
      expect.objectContaining({ status: "PASS", detail: expect.stringContaining("404 accepted") }),
    );
  });

  it("aborts on the first unexpected response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(503));

    await expect(
      runSmoke({ registries: [layer("broken-layer")], fetchImpl, intervalMs: 0 }),
    ).rejects.toMatchObject({
      name: "SmokeError",
      requestCount: 1,
      message: expect.stringContaining("Aborted after first error"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects an unallowlisted tile host before network access", async () => {
    const fetchImpl = vi.fn();
    const untrusted = {
      ...layer("untrusted"),
      tiles: {
        ...layer("untrusted").tiles,
        urlTemplate: "https://evil.example/{z}/{x}/{y}.png",
      },
    };

    await expect(
      runSmoke({ registries: [untrusted], fetchImpl, intervalMs: 0 }),
    ).rejects.toMatchObject({
      name: "SmokeError",
      message: expect.stringContaining("not allowlisted"),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the timeout active while a response body is being consumed", async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("body read aborted")), {
            once: true,
          });
        }),
    }));

    await expect(
      runSmoke({ registries: [], fetchImpl, intervalMs: 0, timeoutMs: 5 }),
    ).rejects.toMatchObject({
      name: "SmokeError",
      message: expect.stringContaining("invalid JSON"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a plan that would exceed twelve requests before network access", async () => {
    const fetchImpl = vi.fn();
    const registries = Array.from({ length: MAX_REQUESTS - 1 }, (_, index) =>
      layer(`layer-${index}`),
    );

    await expect(runSmoke({ registries, fetchImpl, intervalMs: 0 })).rejects.toBeInstanceOf(
      SmokeError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

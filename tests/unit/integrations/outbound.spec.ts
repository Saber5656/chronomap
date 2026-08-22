import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAppleMapsUrl,
  buildGeoUri,
  buildGoogleMapsUrl,
  mapHandoffTargets,
  openExternal,
  type OutboundUrl,
} from "../../../src/integrations/outbound";

function compileOnlyRawUrl(raw: string): void {
  // @ts-expect-error Raw strings must not be accepted by the branded outbound API.
  openExternal(raw);
}

describe("outbound map URL builders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds exact six-decimal URLs for negative and rounded coordinates", () => {
    expect(buildGoogleMapsUrl(-35.1234567, 139.7654321)).toBe(
      "https://www.google.com/maps/search/?api=1&query=-35.123457%2C139.765432",
    );
    expect(buildAppleMapsUrl(-35.1234567, 139.7654321)).toBe(
      "https://maps.apple.com/?ll=-35.123457,139.765432",
    );
    expect(buildGeoUri(-35.1234567, 139.7654321, 15)).toBe("geo:-35.123457,139.765432?z=15");
    expect(buildGeoUri(35, 139)).toBe("geo:35.000000,139.000000");
  });

  it("throws instead of clamping invalid outbound coordinates or zoom", () => {
    expect(() => buildGoogleMapsUrl(91, 0)).toThrow(RangeError);
    expect(() => buildAppleMapsUrl(0, -181)).toThrow(RangeError);
    expect(() => buildGeoUri(Number.NaN, 0)).toThrow(RangeError);
    expect(() => buildGeoUri(35, 139, 15.5)).toThrow(RangeError);
    expect(() => buildGeoUri(35, 139, 19)).toThrow(RangeError);
  });

  it("opens only builder-produced URLs with the required window features", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(window);
    const url = buildGoogleMapsUrl(35.681236, 139.767125);

    openExternal(url);

    expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
  });

  it("keeps a runtime allowlist defense for forged brands", () => {
    expect(() => openExternal("https://evil.example/redirect" as OutboundUrl)).toThrow(TypeError);
  });

  it("documents the branded-string type contract", () => {
    void compileOnlyRawUrl;
    expect(true).toBe(true);
  });
});

describe("map handoff target capability ordering", () => {
  it("hides geo on iOS and puts Apple first", () => {
    expect(mapHandoffTargets("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toEqual([
      "apple",
      "google",
    ]);
    expect(
      mapHandoffTargets(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual(["apple", "google"]);
  });

  it("puts Google and geo first on Android", () => {
    expect(mapHandoffTargets("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toEqual([
      "google",
      "geo",
      "apple",
    ]);
  });

  it("keeps all targets visible on desktop", () => {
    expect(mapHandoffTargets("Mozilla/5.0 (X11; Linux x86_64)")).toEqual([
      "google",
      "apple",
      "geo",
    ]);
  });
});

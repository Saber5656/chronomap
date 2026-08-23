import { describe, expect, it } from "vitest";

import {
  buildAppleMapsUrl,
  buildGeoUri,
  buildGoogleMapsUrl,
  openExternal,
  type OutboundUrl,
} from "../../src/integrations/outbound";

function compileTimeBrandCheck(raw: string): void {
  if (raw.length < 0) {
    // @ts-expect-error A6: callers must use a builder-produced branded URL.
    openExternal(raw);
  }
}

describe("security abuse boundary: outbound map handoff", () => {
  it("A6 rejects every out-of-range coordinate and zoom before URL generation", () => {
    const invalidCalls: Array<() => unknown> = [
      () => buildGoogleMapsUrl(91, 0),
      () => buildGoogleMapsUrl(0, -181),
      () => buildGoogleMapsUrl(Number.NaN, 0),
      () => buildAppleMapsUrl(-91, 0),
      () => buildAppleMapsUrl(0, Number.POSITIVE_INFINITY),
      () => buildGeoUri(35, 139, 1),
      () => buildGeoUri(35, 139, 19),
      () => buildGeoUri(35, 139, 15.5),
      () => buildGeoUri(35, 139, Number.NaN),
    ];

    for (const call of invalidCalls) expect(call).toThrow(RangeError);
  });

  it("A6 emits only hardcoded allowlisted outbound origins", () => {
    const urls = [
      buildGoogleMapsUrl(35.681236, 139.767125),
      buildAppleMapsUrl(35.681236, 139.767125),
      buildGeoUri(35.681236, 139.767125, 16),
    ];

    expect(urls.map((value) => new URL(value).origin)).toEqual([
      "https://www.google.com",
      "https://maps.apple.com",
      "null",
    ]);
    expect(urls.every((value) => !value.includes("evil.example"))).toBe(true);
  });

  it("A6 rejects a forged branded value at the final popup gate", () => {
    const forged = "https://evil.example/?redirect=https://www.google.com" as OutboundUrl;

    expect(() => openExternal(forged)).toThrow(TypeError);
  });

  it("A6 keeps the OutboundUrl brand enforced by TypeScript", () => {
    expect(compileTimeBrandCheck).toBeTypeOf("function");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  parseSharedLocation,
  type ParseResult,
} from "../../../src/integrations/parseSharedLocation";

interface ParseCase {
  name: string;
  input: string;
  expected: ParseResult;
}

const cases: ParseCase[] = [
  {
    name: "geo URI coordinates",
    input: "geo:35.681236,139.767125",
    expected: { ok: true, lat: 35.681236, lng: 139.767125, source: "geo" },
  },
  {
    name: "geo URI zoom",
    input: "geo:35.68,139.76?z=15",
    expected: { ok: true, lat: 35.68, lng: 139.76, zoom: 15, source: "geo" },
  },
  {
    name: "geo URI altitude is ignored",
    input: "geo:-35.68,-139.76,123.4?z=16",
    expected: { ok: true, lat: -35.68, lng: -139.76, zoom: 16, source: "geo" },
  },
  {
    name: "geo URI ignores unsupported query parameters",
    input: "geo:35,139?foo=bar&z=not-a-number",
    expected: { ok: true, lat: 35, lng: 139, source: "geo" },
  },
  {
    name: "geo URI drops a non-finite zoom",
    input: "geo:35,139?z=1e309",
    expected: { ok: true, lat: 35, lng: 139, source: "geo" },
  },
  {
    name: "geo URI with an out-of-range latitude is rejected",
    input: "geo:91,139",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Apple Maps ll",
    input: "https://maps.apple.com/?ll=34.7025,135.4959",
    expected: { ok: true, lat: 34.7025, lng: 135.4959, source: "apple" },
  },
  {
    name: "Apple Maps ll and q label",
    input: "https://maps.apple.com/?ll=34.7025,135.4959&q=Osaka",
    expected: { ok: true, lat: 34.7025, lng: 135.4959, label: "Osaka", source: "apple" },
  },
  {
    name: "Apple Maps label is normalized and sanitized",
    input: "https://maps.apple.com/?ll=34.7025,135.4959&q=%E2%80%AEe%CC%81%00%3Cscript%3E",
    expected: {
      ok: true,
      lat: 34.7025,
      lng: 135.4959,
      label: "é<script>",
      source: "apple",
    },
  },
  {
    name: "Apple Maps label is capped by the validator",
    input: `https://maps.apple.com/?ll=34.7025,135.4959&q=${"a".repeat(121)}`,
    expected: {
      ok: true,
      lat: 34.7025,
      lng: 135.4959,
      label: "a".repeat(120),
      source: "apple",
    },
  },
  {
    name: "Apple Maps address-only fallback",
    input: "https://maps.apple.com/?address=1%20Infinite%20Loop",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Apple Maps address-only never becomes a plain coordinate",
    input: "https://maps.apple.com/?address=35,139%20Main%20Street",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Google Maps query parameter",
    input: "https://www.google.com/maps/search/?api=1&query=35.68%2C139.76",
    expected: { ok: true, lat: 35.68, lng: 139.76, source: "google" },
  },
  {
    name: "Google Maps q parameter",
    input: "https://www.google.com/maps?q=35.68%2C139.76",
    expected: { ok: true, lat: 35.68, lng: 139.76, source: "google" },
  },
  {
    name: "Google query takes precedence over q",
    input: "https://www.google.com/maps?query=35,139&q=36,140",
    expected: { ok: true, lat: 35, lng: 139, source: "google" },
  },
  {
    name: "Google q is tried after a query without coordinates",
    input: "https://www.google.com/maps?query=place&q=36,140",
    expected: { ok: true, lat: 36, lng: 140, source: "google" },
  },
  {
    name: "Google q place name falls through to no-coords",
    input: "https://www.google.com/maps?q=place+name",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Google Maps path with zoom",
    input: "https://www.google.com/maps/@35.68,139.76,15z",
    expected: { ok: true, lat: 35.68, lng: 139.76, zoom: 15, source: "google" },
  },
  {
    name: "Google Maps path without zoom",
    input: "https://www.google.com/maps/@35.68,139.76",
    expected: { ok: true, lat: 35.68, lng: 139.76, source: "google" },
  },
  {
    name: "Google place path with zoom",
    input: "https://maps.google.com/maps/place/Osaka/@34.7025,135.4959,16z/data",
    expected: { ok: true, lat: 34.7025, lng: 135.4959, zoom: 16, source: "google" },
  },
  {
    name: "Google Maps Japanese host",
    input: "https://maps.google.co.jp/maps/@35.68,139.76,15z",
    expected: { ok: true, lat: 35.68, lng: 139.76, zoom: 15, source: "google" },
  },
  {
    name: "Google path zoom above app range is clamped by validator",
    input: "https://www.google.com/maps/@35.68,139.76,21z",
    expected: { ok: true, lat: 35.68, lng: 139.76, zoom: 18, source: "google" },
  },
  {
    name: "Google path zoom outside source range is dropped",
    input: "https://www.google.com/maps/@35.68,139.76,22z",
    expected: { ok: true, lat: 35.68, lng: 139.76, source: "google" },
  },
  {
    name: "Google path with an out-of-range latitude is rejected",
    input: "https://www.google.com/maps/@91,139,15z",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Google path does not partially match an oversized longitude",
    input: "https://www.google.com/maps/@35,1390,15z",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Google path does not partially match a coordinate suffix",
    input: "https://www.google.com/maps/@35,139foo",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "Google host matching is case insensitive",
    input: "https://WWW.GOOGLE.COM/maps?q=35,139",
    expected: { ok: true, lat: 35, lng: 139, source: "google" },
  },
  {
    name: "recognized map URL may use a port",
    input: "https://maps.apple.com:8443/?ll=34.7,135.4",
    expected: { ok: true, lat: 34.7, lng: 135.4, source: "apple" },
  },
  {
    name: "Apple Maps URL with credentials is invalid before plain fallback",
    input: "https://user:pass@maps.apple.com/?ll=34.7,135.4&q=Secret",
    expected: { ok: false, reason: "invalid" },
  },
  {
    name: "Google Maps URL with a username is invalid before plain fallback",
    input: "https://user@www.google.com/maps?q=35.68,139.76",
    expected: { ok: false, reason: "invalid" },
  },
  {
    name: "shortlink maps.app.goo.gl",
    input: "https://maps.app.goo.gl/abc123",
    expected: { ok: false, reason: "shortlink" },
  },
  {
    name: "shortlink goo.gl",
    input: "https://goo.gl/maps/abc123",
    expected: { ok: false, reason: "shortlink" },
  },
  {
    name: "shortlink g.co is case insensitive",
    input: "https://G.CO/abc123",
    expected: { ok: false, reason: "shortlink" },
  },
  {
    name: "shortlink URL with a password is invalid before plain fallback",
    input: "https://:pass@maps.app.goo.gl/35.68,139.76",
    expected: { ok: false, reason: "invalid" },
  },
  {
    name: "plain comma pair",
    input: "35.681236,139.767125",
    expected: { ok: true, lat: 35.681236, lng: 139.767125, source: "plain" },
  },
  {
    name: "plain comma-space pair inside a sentence",
    input: "Meet at the old station: 35.681236, 139.767125.",
    expected: { ok: true, lat: 35.681236, lng: 139.767125, source: "plain" },
  },
  {
    name: "plain whitespace pair",
    input: "coordinates: -35.68 139.76",
    expected: { ok: true, lat: -35.68, lng: 139.76, source: "plain" },
  },
  {
    name: "URL in surrounding text is the first URL-ish token",
    input: "Open this: https://maps.apple.com/?ll=34.7%2C135.4&q=Osaka now",
    expected: { ok: true, lat: 34.7, lng: 135.4, label: "Osaka", source: "apple" },
  },
  {
    name: "javascript URI skips URL recognizers",
    input: "javascript:alert(1)",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "unsupported scheme still permits safe numeric fallback",
    input: "http://www.google.com/maps?q=35.68,139.76",
    expected: { ok: true, lat: 35.68, lng: 139.76, source: "plain" },
  },
  {
    name: "malformed URL falls back without throwing",
    input: "https://[broken 35.68,139.76",
    expected: { ok: true, lat: 35.68, lng: 139.76, source: "plain" },
  },
  {
    name: "latitude above range is rejected",
    input: "91,139",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "longitude below range is rejected",
    input: "35,-181",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "foreign HTTPS host is not a provider",
    input: "https://evil.example/maps?q=35,139",
    expected: { ok: true, lat: 35, lng: 139, source: "plain" },
  },
  {
    name: "empty input",
    input: "   ",
    expected: { ok: false, reason: "no-coords" },
  },
  {
    name: "ten kilobyte input is rejected before parsing",
    input: "35,139" + "x".repeat(10_000),
    expected: { ok: false, reason: "invalid" },
  },
];

describe("parseSharedLocation", () => {
  it.each(cases)("recognizes $name", ({ input, expected }) => {
    expect(parseSharedLocation(input)).toEqual(expected);
  });

  it("accepts the 4096-character boundary", () => {
    const input = `35,139${" ".repeat(4_096 - 6)}`;
    expect(input).toHaveLength(4_096);
    expect(parseSharedLocation(input)).toEqual({
      ok: true,
      lat: 35,
      lng: 139,
      source: "plain",
    });
  });

  it("returns invalid for non-string runtime input", () => {
    expect(parseSharedLocation(null as unknown as string)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("fails closed if normalization unexpectedly throws", () => {
    const normalize = vi.spyOn(String.prototype, "normalize").mockImplementation(() => {
      throw new Error("synthetic normalization failure");
    });

    try {
      expect(parseSharedLocation("35,139")).toEqual({ ok: false, reason: "invalid" });
    } finally {
      normalize.mockRestore();
    }
  });

  it("never throws and preserves ranges for 500 seeded fuzz inputs", () => {
    let seed = 0x35_34_35_30;
    const alphabet = " geo:https://,@?=&qmaps.-_0123456789\u0000\u202e\u{1f5fa}";

    const next = (): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed;
    };

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const length = next() % 180;
      let input = "";
      for (let index = 0; index < length; index += 1) {
        input += alphabet[next() % alphabet.length];
      }

      const result = parseSharedLocation(input);
      if (result.ok) {
        expect(result.lat).toBeGreaterThanOrEqual(-90);
        expect(result.lat).toBeLessThanOrEqual(90);
        expect(result.lng).toBeGreaterThanOrEqual(-180);
        expect(result.lng).toBeLessThanOrEqual(180);
        if (result.zoom !== undefined) {
          expect(result.zoom).toBeGreaterThanOrEqual(2);
          expect(result.zoom).toBeLessThanOrEqual(18);
        }
      }
    }
  });
});

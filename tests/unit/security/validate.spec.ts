import { describe, expect, it } from "vitest";

import {
  extract,
  finiteInRange,
  httpsUrl,
  intInRange,
  label,
  latLng,
  opacity,
  poiTitle,
  year,
  zoom,
} from "../../../src/security/validate";

describe("numeric validators", () => {
  it("clamps finite numbers to inclusive ranges", () => {
    expect(finiteInRange(-2, 0, 10)).toBe(0);
    expect(finiteInRange(11, 0, 10)).toBe(10);
    expect(finiteInRange(5, 0, 10)).toBe(5);
  });

  it("rejects non-finite values and invalid ranges", () => {
    expect(finiteInRange(Number.NaN, 0, 1)).toBeNull();
    expect(finiteInRange(Number.POSITIVE_INFINITY, 0, 1)).toBeNull();
    expect(finiteInRange("1", 0, 1)).toBeNull();
    expect(finiteInRange(1, Number.NaN, 2)).toBeNull();
    expect(finiteInRange(1, 0, Number.POSITIVE_INFINITY)).toBeNull();
    expect(finiteInRange(1, 2, 1)).toBeNull();
  });

  it("accepts integers and rejects fractional values", () => {
    expect(intInRange(5, 0, 10)).toBe(5);
    expect(intInRange(11, 0, 10)).toBe(10);
    expect(intInRange(5.5, 0, 10)).toBeNull();
    expect(intInRange("5", 0, 10)).toBeNull();
  });

  it("rounds coordinates to six decimals and clamps them", () => {
    expect(latLng(91.1234567, -181.1234567)).toEqual({ lat: 90, lng: -180 });
    expect(latLng(35.1234567, 139.7654321)).toEqual({
      lat: 35.123457,
      lng: 139.765432,
    });
  });

  it("rejects coordinates with a non-finite component", () => {
    expect(latLng(Number.NaN, 139)).toBeNull();
    expect(latLng(35, Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it("clamps finite zoom and rejects non-finite zoom", () => {
    expect(zoom(1)).toBe(2);
    expect(zoom(19)).toBe(18);
    expect(zoom(10.25)).toBe(10.25);
    expect(zoom(Number.NaN)).toBeNull();
  });

  it("accepts integer years and clamps them to the active range", () => {
    const now = new Date(2026, 0, 1);
    expect(year(1800, now)).toBe(1890);
    expect(year(2030, now)).toBe(2026);
    expect(year(2000, now)).toBe(2000);
  });

  it("rejects fractional years and invalid dates", () => {
    expect(year(2000.5, new Date(2026, 0, 1))).toBeNull();
    expect(year(2000, new Date(Number.NaN))).toBeNull();
  });

  it("accepts integer opacity percentages and clamps them", () => {
    expect(opacity(-1)).toBe(0);
    expect(opacity(60)).toBe(0.6);
    expect(opacity(101)).toBe(1);
  });

  it("rejects fractional and non-number opacity percentages", () => {
    expect(opacity(60.5)).toBeNull();
    expect(opacity("60")).toBeNull();
  });
});

describe("plain-text validators", () => {
  it("normalizes labels, strips control and bidi characters, and preserves tag text", () => {
    expect(label(" \u202eabc<script>\u0000 ")).toBe("abc<script>");
    expect(label("e\u0301")).toBe("é");
  });

  it("caps labels by Unicode code points", () => {
    expect([...(label("🗺️".repeat(80)) ?? "")]).toHaveLength(120);
  });

  it("rejects empty, control-only, and non-string text", () => {
    expect(label(" \u0000\u202e ")).toBeNull();
    expect(label(123)).toBeNull();
    expect(poiTitle(null)).toBeNull();
    expect(extract(undefined)).toBeNull();
  });

  it("rejects POI titles above the 300-point cap", () => {
    expect(poiTitle("a".repeat(301))).toBeNull();
  });

  it("keeps POI titles at or below the cap unchanged", () => {
    expect(poiTitle(" title ")).toBe("title");
    expect(poiTitle("a".repeat(300))).toBe("a".repeat(300));
  });

  it("truncates long extracts with an ellipsis inside the 1200-point cap", () => {
    const value = extract("a".repeat(1_201));
    expect(value).toBe(`${"a".repeat(1_199)}…`);
    expect([...(value ?? "")]).toHaveLength(1_200);
  });

  it("keeps extracts at or below the cap unchanged", () => {
    expect(extract(" extract ")).toBe("extract");
    expect(extract("a".repeat(1_200))).toBe("a".repeat(1_200));
  });
});

describe("httpsUrl", () => {
  const hosts = new Set(["example.com", "upload.wikimedia.org"]);

  it("accepts and normalizes an allowlisted HTTPS URL", () => {
    expect(httpsUrl("https://example.com/path?q=1", hosts)).toBe("https://example.com/path?q=1");
  });

  it("rejects non-HTTPS and foreign hosts", () => {
    expect(httpsUrl("http://example.com/path", hosts)).toBeNull();
    expect(httpsUrl("https://evil.example/path", hosts)).toBeNull();
  });

  it("rejects credentials and explicit alternate ports", () => {
    expect(httpsUrl("https://user:pass@example.com/path", hosts)).toBeNull();
    expect(httpsUrl("https://example.com:8443/path", hosts)).toBeNull();
  });

  it("rejects malformed and non-string input", () => {
    expect(httpsUrl("not a url", hosts)).toBeNull();
    expect(httpsUrl({ href: "https://example.com" }, hosts)).toBeNull();
  });
});

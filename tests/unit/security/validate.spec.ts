import { describe, expect, it } from "vitest";

import { opacity, year } from "../../../src/security/validate";

describe("numeric validator stubs", () => {
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

  it("rejects fractional opacity percentages", () => {
    expect(opacity(60.5)).toBeNull();
  });
});

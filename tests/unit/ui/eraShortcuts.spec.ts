import { describe, expect, it } from "vitest";
import { createMobileRegistry } from "../../../apps/mobile/src/model";
import { eraShortcuts } from "../../../src/ui/eraShortcuts";

describe("available era shortcuts", () => {
  const registry = createMobileRegistry(2026);

  it("offers only available imagery, ordered by representative year", () => {
    expect(eraShortcuts(registry, ["gsi-seamlessphoto", "gsi-ort-old10"], 2026)).toEqual([
      { id: "gsi-ort-old10", year: 1965 },
      { id: "gsi-seamlessphoto", year: 2026 },
    ]);
  });

  it("does not imply coverage where none exists", () => {
    expect(eraShortcuts(registry, [], 2026)).toEqual([]);
    expect(eraShortcuts(registry, ["unknown"], 2026)).toEqual([]);
  });

  it("never offers a future year and updates the present shortcut with the calendar", () => {
    const entries = registry.filter((entry) => entry.id === "gsi-seamlessphoto");
    expect(eraShortcuts(entries, ["gsi-seamlessphoto"], 2027)[0]?.year).toBe(2027);
    expect(
      eraShortcuts(
        registry,
        registry.map((entry) => entry.id),
        1965,
      ).every((item) => item.year <= 1965),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { getPhotoProvider } from "../../../../src/providers/poi/registry";

describe("POI photo registry", () => {
  it("keeps the experimental provider disabled by default", () => {
    expect(getPhotoProvider(false)).toBeNull();
  });

  it("returns the Commons provider only when explicitly enabled", () => {
    expect(getPhotoProvider(true)).not.toBeNull();
  });
});

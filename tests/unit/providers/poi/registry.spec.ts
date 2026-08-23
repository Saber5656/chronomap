import { describe, expect, it } from "vitest";

import { getPhotoProvider } from "../../../../src/providers/poi/registry";

describe("getPhotoProvider", () => {
  it("does not expose the Commons provider when the flag is off", () => {
    expect(getPhotoProvider(false)).toBeNull();
  });

  it("returns a lazy provider only when explicitly enabled", () => {
    expect(getPhotoProvider(true)).not.toBeNull();
  });
});

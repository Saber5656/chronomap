import { describe, expect, it } from "vitest";

import { isShareRoute, normalizeBasePath, normalizeRoutePath } from "../../../src/app/routes";

describe("application routes", () => {
  it("normalizes base and route paths without changing the root", () => {
    expect(normalizeRoutePath("chronomap/share/")).toBe("/chronomap/share");
    expect(normalizeRoutePath("///")).toBe("/");
    expect(normalizeBasePath("/chronomap/")).toBe("/chronomap");
    expect(normalizeBasePath("./")).toBe("/");
  });

  it.each([
    ["/chronomap/share", "/chronomap/", true],
    ["/chronomap/share/", "/chronomap/", true],
    ["/share", "/", true],
    ["/other/share", "/chronomap/", false],
    ["/chronomap/share-extra", "/chronomap/", false],
  ])("detects a base-aware share route: %s under %s", (pathname, basePath, expected) => {
    expect(isShareRoute(pathname, basePath)).toBe(expected);
  });
});

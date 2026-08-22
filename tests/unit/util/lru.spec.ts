import { describe, expect, it } from "vitest";

import { createLru } from "../../../src/util/lru";

describe("createLru", () => {
  it("evicts the oldest entry and refreshes an entry when it is read", () => {
    const cache = createLru<string, number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("replaces a key without growing the cache", () => {
    const cache = createLru<string, string>(2);

    cache.set("a", "old");
    cache.set("b", "b");
    cache.set("a", "new");
    cache.set("c", "c");

    expect(cache.get("a")).toBe("new");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.delete("missing")).toBe(false);
    expect(cache.delete("c")).toBe(true);
    expect(cache.size).toBe(1);
  });

  it("supports capacity one and clearing", () => {
    const cache = createLru<string, number>(1);

    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("b")).toBeUndefined();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid capacity %s",
    (capacity) => {
      expect(() => createLru(capacity)).toThrow(RangeError);
    },
  );
});

import { describe, expect, it, vi } from "vitest";

import { createStore } from "../../../src/state/store";

describe("createStore", () => {
  it("returns the initial state", () => {
    expect(createStore({ count: 1 }).get()).toEqual({ count: 1 });
  });

  it("shallow-merges object patches", () => {
    const store = createStore({ count: 1, label: "a" });
    store.set({ count: 2 });
    expect(store.get()).toEqual({ count: 2, label: "a" });
  });

  it("accepts functional full-state replacements", () => {
    const store = createStore({ count: 1, label: "a" });
    store.set((state) => ({ ...state, count: state.count + 1 }));
    expect(store.get().count).toBe(2);
  });

  it("notifies with next and previous selected values", () => {
    const store = createStore({ count: 1 });
    const callback = vi.fn();
    store.on((state) => state.count, callback);
    store.set({ count: 2 });
    expect(callback).toHaveBeenCalledWith(2, 1);
  });

  it("deduplicates selected values with Object.is", () => {
    const store = createStore({ value: Number.NaN, other: 0 });
    const callback = vi.fn();
    store.on((state) => state.value, callback);
    store.set({ value: Number.NaN, other: 1 });
    expect(callback).not.toHaveBeenCalled();
  });

  it("notifies subscriptions in registration order", () => {
    const store = createStore({ count: 0 });
    const order: string[] = [];
    store.on((state) => state.count, () => order.push("first"));
    store.on((state) => state.count, () => order.push("second"));
    store.set({ count: 1 });
    expect(order).toEqual(["first", "second"]);
  });

  it("unsubscribes without affecting later subscriptions", () => {
    const store = createStore({ count: 0 });
    const removed = vi.fn();
    const retained = vi.fn();
    const unsubscribe = store.on((state) => state.count, removed);
    store.on((state) => state.count, retained);
    unsubscribe();
    store.set({ count: 1 });
    expect(removed).not.toHaveBeenCalled();
    expect(retained).toHaveBeenCalledOnce();
  });

  it("notifies only selectors whose value changed", () => {
    const store = createStore({ count: 0, label: "a" });
    const countCallback = vi.fn();
    const labelCallback = vi.fn();
    store.on((state) => state.count, countCallback);
    store.on((state) => state.label, labelCallback);
    store.set({ count: 1 });
    expect(countCallback).toHaveBeenCalledOnce();
    expect(labelCallback).not.toHaveBeenCalled();
  });

  it("swaps state before callbacks run", () => {
    const store = createStore({ count: 0 });
    let observed = -1;
    store.on(
      (state) => state.count,
      () => {
        observed = store.get().count;
      },
    );
    store.set({ count: 1 });
    expect(observed).toBe(1);
  });

  it("queues re-entrant sets in a microtask", async () => {
    const store = createStore({ count: 0 });
    const seen: number[] = [];
    store.on(
      (state) => state.count,
      (next) => {
        seen.push(next);
        if (next === 1) store.set({ count: 2 });
      },
    );
    store.set({ count: 1 });
    expect(seen).toEqual([1]);
    await Promise.resolve();
    expect(seen).toEqual([1, 2]);
  });

  it("flushes multiple re-entrant sets in insertion order", async () => {
    const store = createStore({ count: 0 });
    const seen: number[] = [];
    store.on(
      (state) => state.count,
      (next) => {
        seen.push(next);
        if (next === 1) {
          store.set({ count: 2 });
          store.set({ count: 3 });
        }
      },
    );
    store.set({ count: 1 });
    await Promise.resolve();
    expect(seen).toEqual([1, 2, 3]);
  });

  it("continues to accept sets after a callback throws", () => {
    const store = createStore({ count: 0 });
    const unsubscribe = store.on(
      (state) => state.count,
      () => {
        throw new Error("boom");
      },
    );
    expect(() => store.set({ count: 1 })).toThrow("boom");
    unsubscribe();
    expect(() => store.set({ count: 2 })).not.toThrow();
    expect(store.get().count).toBe(2);
  });

  it("supports selectors that return object identities", () => {
    const initial = { value: 1 };
    const store = createStore({ nested: initial });
    const callback = vi.fn();
    store.on((state) => state.nested, callback);
    store.set({ nested: initial });
    store.set({ nested: { value: 1 } });
    expect(callback).toHaveBeenCalledOnce();
  });
});

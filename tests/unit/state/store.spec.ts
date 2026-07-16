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
    store.on(
      (state) => state.count,
      () => order.push("first"),
    );
    store.on(
      (state) => state.count,
      () => order.push("second"),
    );
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

  it("preserves call order while a re-entrant flush is pending", async () => {
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
    store.set({ count: 3 });
    await Promise.resolve();
    expect(seen).toEqual([1, 2, 3]);
    expect(store.get().count).toBe(3);
  });

  it("defers re-entrant work raised during a flush to the next microtask", () => {
    const tasks: Array<() => void> = [];
    vi.stubGlobal("queueMicrotask", (task: () => void) => tasks.push(task));
    try {
      const store = createStore({ count: 0 });
      const seen: number[] = [];
      store.on(
        (state) => state.count,
        (next) => {
          seen.push(next);
          if (next === 1) store.set({ count: 2 });
          if (next === 2) store.set({ count: 3 });
        },
      );
      store.set({ count: 1 });
      tasks.shift()?.();
      expect(seen).toEqual([1, 2]);
      expect(tasks).toHaveLength(1);
      tasks.shift()?.();
      expect(seen).toEqual([1, 2, 3]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not notify subscriptions added during the current update", () => {
    const store = createStore({ count: 0 });
    const added = vi.fn();
    store.on(
      (state) => state.count,
      () => store.on((state) => ({ count: state.count }), added),
    );
    store.set({ count: 1 });
    expect(added).not.toHaveBeenCalled();
    store.set({ count: 2 });
    expect(added).toHaveBeenCalledOnce();
  });

  it("allows a listener to unsubscribe another listener during notification", () => {
    const store = createStore({ count: 0 });
    const removed = vi.fn();
    let unsubscribe: () => void = () => undefined;
    store.on(
      (state) => state.count,
      () => unsubscribe(),
    );
    unsubscribe = store.on((state) => state.count, removed);
    store.set({ count: 1 });
    store.set({ count: 2 });
    expect(removed).not.toHaveBeenCalled();
  });

  it("keeps queued work runnable when a callback throws during a flush", () => {
    const tasks: Array<() => void> = [];
    vi.stubGlobal("queueMicrotask", (task: () => void) => tasks.push(task));
    try {
      const store = createStore({ count: 0 });
      const unsubscribe = store.on(
        (state) => state.count,
        (next) => {
          if (next === 1) store.set({ count: 2 });
          if (next === 2) {
            store.set({ count: 3 });
            throw new Error("boom");
          }
        },
      );
      store.set({ count: 1 });
      store.set({ count: 4 });
      expect(tasks).toHaveLength(1);
      expect(() => tasks.shift()?.()).toThrow("boom");
      expect(tasks).toHaveLength(1);
      unsubscribe();
      tasks.shift()?.();
      expect(store.get().count).toBe(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("allows repeated unsubscribe calls", () => {
    const store = createStore({ count: 0 });
    const unsubscribe = store.on((state) => state.count, vi.fn());
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
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

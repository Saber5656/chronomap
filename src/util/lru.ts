export interface Lru<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): boolean;
  clear(): void;
  readonly size: number;
}

/** Create a small least-recently-used cache backed by insertion-ordered Map semantics. */
export function createLru<K, V>(capacity: number): Lru<K, V> {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError("LRU capacity must be a positive integer.");
  }

  const entries = new Map<K, V>();

  return {
    get(key) {
      if (!entries.has(key)) return undefined;

      const value = entries.get(key) as V;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },

    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      if (entries.size > capacity) {
        const oldestKey = entries.keys().next().value as K;
        entries.delete(oldestKey);
      }
    },

    delete(key) {
      return entries.delete(key);
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    },
  };
}

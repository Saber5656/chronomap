export type ShallowPatch<S> = Partial<{ [K in keyof S]: S[K] }>;

export interface Store<S> {
  get(): Readonly<S>;
  set(patch: ShallowPatch<S> | ((state: Readonly<S>) => S)): void;
  on<T>(selector: (state: S) => T, callback: (next: T, previous: T) => void): () => void;
}

interface Subscription<S> {
  active: boolean;
  selected: unknown;
  selector: (state: S) => unknown;
  callback: (next: unknown, previous: unknown) => void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  let notifying = false;
  let flushing = false;
  let flushScheduled = false;
  const subscriptions = new Set<Subscription<S>>();
  const pending: Array<ShallowPatch<S> | ((state: Readonly<S>) => S)> = [];

  function flushPending(): void {
    flushScheduled = false;
    flushing = true;
    const queued = pending.splice(0);
    let index = 0;
    try {
      for (; index < queued.length; index += 1) {
        set(queued[index]!);
      }
    } finally {
      if (index + 1 < queued.length) {
        pending.unshift(...queued.slice(index + 1));
      }
      flushing = false;
      if (pending.length > 0 && !flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flushPending);
      }
    }
  }

  function set(patch: ShallowPatch<S> | ((state: Readonly<S>) => S)): void {
    if (notifying || (flushScheduled && !flushing)) {
      pending.push(patch);
      if (!flushing && !flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flushPending);
      }
      return;
    }

    state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    notifying = true;
    try {
      for (const subscription of [...subscriptions]) {
        if (!subscription.active) {
          continue;
        }
        const next = subscription.selector(state);
        if (Object.is(next, subscription.selected)) {
          continue;
        }
        const previous = subscription.selected;
        subscription.selected = next;
        subscription.callback(next, previous);
      }
    } finally {
      notifying = false;
    }
  }

  function on<T>(selector: (state: S) => T, callback: (next: T, previous: T) => void): () => void {
    const subscription: Subscription<S> = {
      active: true,
      selected: selector(state),
      selector,
      callback: callback as (next: unknown, previous: unknown) => void,
    };
    subscriptions.add(subscription);
    return () => {
      if (!subscription.active) return;
      subscription.active = false;
      subscriptions.delete(subscription);
    };
  }

  return {
    get: () => state,
    set,
    on,
  };
}

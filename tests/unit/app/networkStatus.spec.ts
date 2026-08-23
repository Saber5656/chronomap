import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mountNetworkStatus,
  OFFLINE_HYSTERESIS_MS,
  recordTileFailure,
  type TileFailureRecord,
} from "../../../src/app/networkStatus";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

describe("network status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces offline and recovery transitions without flapping spam", () => {
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const controller = mountNetworkStatus(store);

    window.dispatchEvent(new Event("offline"));
    expect(store.get().ui.offline).toBe(true);
    expect(store.get().ui.toast?.text).toBe("オフラインのようです — 地図データは読み込めません");
    const firstOfflineToastId = store.get().ui.toast?.id;

    window.dispatchEvent(new Event("offline"));
    expect(store.get().ui.toast?.id).toBe(firstOfflineToastId);

    window.dispatchEvent(new Event("online"));
    expect(store.get().ui.offline).toBe(false);
    expect(store.get().ui.toast?.text).toBe("オンラインに戻りました");

    vi.advanceTimersByTime(OFFLINE_HYSTERESIS_MS - 1);
    window.dispatchEvent(new Event("offline"));
    expect(store.get().ui.offline).toBe(true);
    expect(store.get().ui.toast?.text).toBe("オンラインに戻りました");

    window.dispatchEvent(new Event("online"));
    expect(store.get().ui.offline).toBe(false);
    expect(store.get().ui.toast?.text).toBe("オンラインに戻りました");

    controller.destroy();
  });

  it("notifies after eleven failures and rate-limits the next notice", () => {
    let failures: readonly number[] = [];
    let lastNotice = Number.NEGATIVE_INFINITY;
    let result: TileFailureRecord = {
      failures: [],
      lastNotice: Number.NEGATIVE_INFINITY,
      notify: false,
    };
    for (let index = 0; index < 11; index += 1) {
      result = recordTileFailure(index * 500, failures, lastNotice);
      failures = result.failures;
      lastNotice = result.lastNotice;
    }
    expect(result.notify).toBe(true);
    expect(failures).toHaveLength(11);

    result = recordTileFailure(10_000, failures, lastNotice);
    expect(result.notify).toBe(false);
    for (let index = 0; index < 11; index += 1) {
      result = recordTileFailure(310_001 + index * 500, result.failures, result.lastNotice);
    }
    expect(result.notify).toBe(true);
    expect(result.failures.every((at) => 315_001 - at <= 10_000)).toBe(true);
  });
});

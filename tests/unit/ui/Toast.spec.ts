import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../../src/state/appState";
import { createActions } from "../../../src/state/actions";
import { createStore } from "../../../src/state/store";
import {
  ACTION_TOAST_DURATION_MS,
  mount,
  TOAST_DURATION_MS,
} from "../../../src/ui/components/Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders store toasts safely and dismisses them after four seconds", () => {
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const handle = mount(parent, store);
    const toast = parent.querySelector<HTMLElement>(".toast");

    expect(toast?.hidden).toBe(true);
    actions.showToast("error", "<script>not markup</script>");
    expect(toast?.hidden).toBe(false);
    expect(toast?.textContent).toBe("<script>not markup</script>");
    expect(toast?.getAttribute("aria-live")).toBe("polite");

    vi.advanceTimersByTime(3_999);
    expect(toast?.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(toast?.hidden).toBe(true);

    handle.destroy();
  });

  it("keeps the active toast visible and drops the oldest pending item", () => {
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const handle = mount(parent, store);
    const toast = parent.querySelector<HTMLElement>(".toast");

    actions.showToast("info", "one");
    actions.showToast("info", "two");
    actions.showToast("info", "three");
    actions.showToast("info", "four");
    actions.showToast("info", "five");

    expect(toast?.textContent).toBe("one");
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(toast?.textContent).toBe("three");

    handle.destroy();
  });

  it("does not extend the active toast lifetime when a pending toast arrives", () => {
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const actions = createActions(store);
    const handle = mount(parent, store);
    const toast = parent.querySelector<HTMLElement>(".toast");

    actions.showToast("info", "active");
    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    actions.showToast("info", "pending");
    vi.advanceTimersByTime(1);

    expect(toast?.textContent).toBe("pending");
    handle.destroy();
  });

  it("renders action toasts for eight seconds and invokes the action once", () => {
    const parent = document.createElement("div");
    const store = createStore(createInitialState(new Date(2026, 0, 1)));
    const action = vi.fn();
    const handle = mount(parent, store);

    handle.showActionToast?.("info", "新しいバージョンがあります", {
      label: "更新",
      onAction: action,
    });
    const toast = parent.querySelector<HTMLElement>(".toast");
    const button = parent.querySelector<HTMLButtonElement>(".toast__action");
    expect(toast?.textContent).toBe("新しいバージョンがあります更新");
    expect(button?.textContent).toBe("更新");

    vi.advanceTimersByTime(ACTION_TOAST_DURATION_MS - 1);
    expect(toast?.hidden).toBe(false);
    button?.click();
    expect(action).toHaveBeenCalledOnce();
    expect(toast?.hidden).toBe(true);

    handle.destroy();
  });
});

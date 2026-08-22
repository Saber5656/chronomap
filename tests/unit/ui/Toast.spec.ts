import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialState } from "../../../src/state/appState";
import { createActions } from "../../../src/state/actions";
import { createStore } from "../../../src/state/store";
import { mount } from "../../../src/ui/components/Toast";

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
});

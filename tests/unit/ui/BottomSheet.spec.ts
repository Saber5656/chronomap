import { afterEach, describe, expect, it, vi } from "vitest";

import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";
import { mount, type BottomSheetOptions } from "../../../src/ui/components/BottomSheet";

interface FakeHistory {
  state: unknown;
  replaceState: ReturnType<typeof vi.fn>;
  pushState: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
}

function fakeHistory(): FakeHistory {
  const value: FakeHistory = {
    state: null,
    replaceState: vi.fn((next: unknown) => {
      value.state = next;
    }),
    pushState: vi.fn((next: unknown) => {
      value.state = next;
    }),
    back: vi.fn(),
  };
  return value;
}

function pointerEvent(type: string, clientY: number): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientY: { value: clientY },
    pointerId: { value: 1 },
    isPrimary: { value: true },
  });
  return event;
}

function setup() {
  const parent = document.createElement("div");
  const opener = document.createElement("button");
  opener.textContent = "open";
  document.body.append(opener, parent);
  opener.focus();
  const store = createStore(createInitialState(new Date(2026, 0, 1)));
  const history = fakeHistory();
  const controller = mount(parent, store, {
    history: history as unknown as NonNullable<BottomSheetOptions["history"]>,
    location: { href: "https://example.test/chronomap/" },
    renderers: {
      layers: (content) => {
        const first = document.createElement("button");
        first.textContent = "first";
        const second = document.createElement("button");
        second.textContent = "second";
        content.append(first, second);
        return { destroy: () => content.replaceChildren() };
      },
    },
  });
  return { controller, history, opener, parent, store };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("BottomSheet", () => {
  it("renders one dialog, uses a single back checkpoint, and replaces sheet transitions", () => {
    const { controller, history, parent, store } = setup();
    const actions = createActions(store);

    actions.openSheet("layers");
    expect(parent.querySelector<HTMLElement>("[role='dialog']")?.getAttribute("aria-modal")).toBe(
      "true",
    );
    expect(history.replaceState).toHaveBeenCalled();
    expect(history.pushState).toHaveBeenCalledOnce();

    actions.openSheet("about");
    expect(history.pushState).toHaveBeenCalledOnce();
    expect(parent.querySelector("[data-sheet-stub='about']")).not.toBeNull();
    controller.destroy();
  });

  it("traps focus, closes on Escape/swipe, and returns focus to the opener", () => {
    const { controller, history, opener, parent, store } = setup();
    const actions = createActions(store);
    actions.openSheet("layers");

    const dialog = parent.querySelector<HTMLElement>("[role='dialog']");
    const close = parent.querySelector<HTMLButtonElement>(".bottom-sheet__close");
    const second = parent.querySelectorAll<HTMLButtonElement>(".bottom-sheet__content button")[1];
    if (dialog === null || close === null || second === undefined) {
      throw new Error("Expected the mounted sheet controls.");
    }
    expect(document.activeElement).toBe(close);

    second.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(close);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(store.get().ui.sheet).toBe("none");
    expect(parent.querySelector("[role='dialog']")).toBeNull();
    expect(history.back).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);

    actions.openSheet("layers");
    const handle = parent.querySelector<HTMLElement>(".bottom-sheet__handle");
    if (handle === null) throw new Error("Expected the sheet drag handle.");
    handle.dispatchEvent(pointerEvent("pointerdown", 0));
    handle.dispatchEvent(pointerEvent("pointerup", 100));
    expect(store.get().ui.sheet).toBe("none");
    controller.destroy();
  });

  it("closes the active sheet on a browser popstate event", () => {
    const { controller, parent, store } = setup();
    createActions(store).openSheet("layers");

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(store.get().ui.sheet).toBe("none");
    expect(parent.querySelector("[role='dialog']")).toBeNull();
    controller.destroy();
  });
});

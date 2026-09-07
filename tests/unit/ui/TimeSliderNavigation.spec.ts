import { describe, expect, it } from "vitest";
import { mountTimeSlider } from "../../../src/ui/components/TimeSlider";
import { createMobileRegistry } from "../../../apps/mobile/src/model";
import { createActions } from "../../../src/state/actions";
import { createInitialState } from "../../../src/state/appState";
import { createStore } from "../../../src/state/store";

describe("visible time navigation", () => {
  it("selects an available era and returns to today without dragging", () => {
    const store = createStore(createInitialState(new Date("2026-09-08")));
    const actions = createActions(store);
    actions.setActiveLayer("gsi-ort-old10", {
      reason: "ok",
      snapped: false,
      candidates: ["gsi-ort-old10", "gsi-seamlessphoto"],
    });
    const parent = document.createElement("div");
    const slider = mountTimeSlider(parent, store, {
      registry: createMobileRegistry(2026),
      currentYear: 2026,
    });
    const era = parent.querySelector<HTMLButtonElement>('button[data-era-year="1965"]');
    expect(era).not.toBeNull();
    era!.click();
    expect(store.get().year).toBe(1965);
    expect(parent.querySelector(".time-navigation__year")?.textContent).toContain("1965");
    parent.querySelector<HTMLButtonElement>(".time-navigation__today")!.click();
    expect(store.get().year).toBe(2026);
    actions.setActiveLayer(null, { reason: "registry-empty", snapped: false, candidates: [] });
    expect(parent.querySelector<HTMLButtonElement>(".time-navigation__today")?.disabled).toBe(true);
    slider.destroy();
    expect(parent.childElementCount).toBe(0);
  });
});

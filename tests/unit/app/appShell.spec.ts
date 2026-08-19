import { describe, expect, it } from "vitest";

import { mount } from "../../../src/app/appShell";
import { createStore } from "../../../src/state/store";

describe("AppShell mount", () => {
  it("creates the canonical shell and component slot topology", () => {
    const parent = document.createElement("div");
    const shell = mount(parent, createStore({}));
    const root = parent.querySelector(".shell");

    expect(root).not.toBeNull();
    if (root === null) throw new Error("Expected AppShell root.");

    expect(root.querySelector("header.controls-top")).toBe(shell.getSlot("controls-top"));
    expect(root.querySelector("main.map-region")).toBe(shell.getSlot("map-region"));
    expect(root.querySelector("main.map-region > #map")).toBe(shell.getSlot("map"));
    expect(root.querySelector("footer.slider-dock")).toBe(shell.getSlot("slider-dock"));
    expect(root.querySelector("#sheet-host")).toBe(shell.getSlot("sheet-host"));
    expect(root.querySelector("#toast-host")).toBe(shell.getSlot("toast-host"));

    for (const name of [
      "LocateButton",
      "PoiToggle",
      "MenuButton",
      "CoverageBanner",
      "LayerInfoBadge",
      "TimeSlider",
      "OpacityControl",
    ] as const) {
      expect(shell.getSlot(name).dataset.slot).toBe(name);
      expect(root.contains(shell.getSlot(name))).toBe(true);
    }
  });

  it("removes only its owned subtree and makes destroy idempotent", () => {
    const parent = document.createElement("div");
    const retained = document.createElement("aside");
    parent.append(retained);
    const shell = mount(parent, createStore({}));

    shell.destroy();
    shell.destroy();

    expect(parent.contains(retained)).toBe(true);
    expect(parent.querySelector(".shell")).toBeNull();
  });
});

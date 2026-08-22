import { describe, expect, it } from "vitest";

import { el } from "../../../src/util/dom";

describe("el", () => {
  it("creates a typed element and serializes attributes", () => {
    const button = el("button", {
      class: "action",
      "data-count": 2,
      "aria-pressed": false,
      "data-omitted": null,
    });

    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toBe("action");
    expect(button.getAttribute("data-count")).toBe("2");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.hasAttribute("data-omitted")).toBe(false);
  });

  it("renders text children as text and preserves node order", () => {
    const child = el("span", undefined, "nested");
    const parent = el("div", undefined, ["before", child, "<b>after</b>"]);

    expect(parent.textContent).toBe("beforenested<b>after</b>");
    expect(parent.querySelector("b")).toBeNull();
    expect(parent.childNodes).toHaveLength(3);
    expect(parent.childNodes[1]).toBe(child);
  });
});

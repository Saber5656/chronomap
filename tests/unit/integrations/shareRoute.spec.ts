import { describe, expect, it, vi } from "vitest";

import { handleShareRoute, selectShareInput } from "../../../src/integrations/shareRoute";

function fakePage(pathname: string, search = "") {
  const current = new URL(`https://example.test${pathname}${search}`);
  const replace = vi.fn<(target: string) => void>();
  const history = { replaceState: vi.fn() };
  return {
    location: { href: current.href, origin: current.origin, replace },
    history,
  };
}

describe("selectShareInput", () => {
  it("prefers url, then tries a text-plus-url candidate", () => {
    const selection = selectShareInput(
      new URLSearchParams({
        title: "Osaka",
        text: "geo:34.70,135.49",
        url: "https://maps.app.goo.gl/example",
      }),
    );

    expect(selection).toEqual({
      primary: "https://maps.app.goo.gl/example",
      candidates: [
        "https://maps.app.goo.gl/example",
        "geo:34.70,135.49 https://maps.app.goo.gl/example",
      ],
    });
  });

  it("falls through empty fields to title without manufacturing a second candidate", () => {
    expect(selectShareInput(new URLSearchParams("url=%20&text=&title=Osaka"))).toEqual({
      primary: "Osaka",
      candidates: ["Osaka"],
    });
  });
});

describe("handleShareRoute", () => {
  it("redirects geo input to the base deep link with the default zoom", () => {
    const page = fakePage("/chronomap/share", "?text=geo%3A35.68%2C139.76");
    const outcome = handleShareRoute({
      basePath: "/chronomap/",
      location: page.location,
      history: page.history,
    });

    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") throw new Error("Expected a redirect outcome.");
    const target = new URL(outcome.target);
    expect(target.pathname).toBe("/chronomap/");
    expect(target.search).toBe("?lat=35.68&lng=139.76&z=16");
    expect(page.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "https://example.test/chronomap/",
    );
    expect(page.location.replace).toHaveBeenCalledWith(outcome.target);
  });

  it("uses the concatenated text and url when the primary shortlink fails", () => {
    const page = fakePage(
      "/chronomap/share",
      `?url=${encodeURIComponent("https://maps.app.goo.gl/example")}&text=${encodeURIComponent("geo:34.70,135.49")}`,
    );
    const outcome = handleShareRoute({
      basePath: "/chronomap/",
      location: page.location,
      history: page.history,
    });

    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") throw new Error("Expected a redirect outcome.");
    expect(new URL(outcome.target).search).toBe("?lat=34.7&lng=135.49&z=16");
  });

  it("preserves an Apple label in the encoded deep link and deliberately omits year", () => {
    const appleUrl = "https://maps.apple.com/?ll=34.70,135.49&q=Osaka";
    const page = fakePage("/chronomap/share", `?url=${encodeURIComponent(appleUrl)}`);
    const outcome = handleShareRoute({
      basePath: "/chronomap/",
      location: page.location,
      history: page.history,
    });

    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") throw new Error("Expected a redirect outcome.");
    const target = new URL(outcome.target);
    expect(target.searchParams.get("label")).toBe("Osaka");
    expect(target.searchParams.has("year")).toBe(false);
  });

  it("cleans the address bar and opens a bounded, reason-specific fallback", () => {
    const page = fakePage(
      "/chronomap/share",
      `?text=${encodeURIComponent("https://maps.app.goo.gl/example")}`,
    );
    const outcome = handleShareRoute({
      basePath: "/chronomap/",
      location: page.location,
      history: page.history,
    });

    expect(outcome).toEqual({
      kind: "fallback",
      fallback: { prefill: "https://maps.app.goo.gl/example", reason: "shortlink" },
    });
    expect(page.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "https://example.test/chronomap/",
    );
    expect(page.location.replace).not.toHaveBeenCalled();
  });

  it("caps the fallback prefill at 500 code points", () => {
    const title = "😀".repeat(600);
    const page = fakePage("/chronomap/share", `?title=${encodeURIComponent(title)}`);
    const outcome = handleShareRoute({
      basePath: "/chronomap/",
      location: page.location,
      history: page.history,
    });

    expect(outcome.kind).toBe("fallback");
    if (outcome.kind !== "fallback") throw new Error("Expected a fallback outcome.");
    expect([...outcome.fallback.prefill]).toHaveLength(500);
    expect(outcome.fallback.prefill).toBe("😀".repeat(500));
  });

  it("does not handle a route whose base would cross origins", () => {
    const page = fakePage("/chronomap/share", "?text=geo%3A35%2C139");
    const outcome = handleShareRoute({
      basePath: "https://evil.example/",
      location: page.location,
      history: page.history,
    });

    expect(outcome).toEqual({ kind: "not-share" });
    expect(page.location.replace).not.toHaveBeenCalled();
    expect(page.history.replaceState).not.toHaveBeenCalled();
  });
});

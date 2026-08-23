import { describe, expect, it } from "vitest";
import indexHtml from "../../../index.html?raw";

import {
  buildContentSecurityPolicy,
  cspConnectHosts,
  cspImageHosts,
} from "../../../src/security/csp";
import {
  isFeatureFlagEnabled,
  KONJAKU_FEATURE_FLAG,
  KONJAKU_HOST,
  TILE_HOSTS,
  WIKIMEDIA_API_HOSTS,
  WIKIMEDIA_IMG_HOSTS,
} from "../../../src/security/hosts";

function metaContent(attribute: "http-equiv" | "name", value: string): string {
  const tag = indexHtml.match(
    new RegExp(`<meta\\b[^>]*\\b${attribute}=["']${value}["'][^>]*>`, "iu"),
  )?.[0];
  if (tag === undefined) throw new Error(`Missing ${value} meta tag`);

  const content = tag.match(/\bcontent="([^"]*)"/u)?.[1];
  if (content === undefined) throw new Error(`Missing content for ${value} meta tag`);
  return content;
}

describe("Content Security Policy", () => {
  it("pins the checked-in default meta policy to the canonical builder", () => {
    const policy = metaContent("http-equiv", "Content-Security-Policy");
    expect(policy).toBe(buildContentSecurityPolicy());
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("keeps the document referrer policy at no-referrer", () => {
    expect(metaContent("name", "referrer")).toBe("no-referrer");
  });

  it("derives provider origins from hosts.ts and gates Konjaku exactly", () => {
    const defaultPolicy = buildContentSecurityPolicy();
    const enabledPolicy = buildContentSecurityPolicy({ enableKonjaku: true });

    for (const host of [...TILE_HOSTS, ...WIKIMEDIA_IMG_HOSTS]) {
      expect(defaultPolicy.includes(`https://${host}`)).toBe(host !== KONJAKU_HOST);
      expect(enabledPolicy).toContain(`https://${host}`);
    }
    for (const host of WIKIMEDIA_API_HOSTS) {
      expect(defaultPolicy).toContain(`https://${host}`);
      expect(enabledPolicy).toContain(`https://${host}`);
    }

    expect(cspImageHosts()).toEqual(["cyberjapandata.gsi.go.jp", "upload.wikimedia.org"]);
    expect(cspImageHosts({ enableKonjaku: true })).toEqual([
      "cyberjapandata.gsi.go.jp",
      "upload.wikimedia.org",
      KONJAKU_HOST,
    ]);
    expect(cspConnectHosts()).toEqual([
      "cyberjapandata.gsi.go.jp",
      "ja.wikipedia.org",
      "en.wikipedia.org",
      "commons.wikimedia.org",
    ]);
    expect(cspConnectHosts({ enableKonjaku: true })).toContain(KONJAKU_HOST);
    expect(defaultPolicy).not.toContain(KONJAKU_HOST);
  });

  it("uses the same exact-string feature flag contract as the registry", () => {
    expect(isFeatureFlagEnabled({ [KONJAKU_FEATURE_FLAG]: "true" }, KONJAKU_FEATURE_FLAG)).toBe(
      true,
    );
    for (const value of [undefined, "", "false", false, true, "TRUE", "1", 1]) {
      expect(isFeatureFlagEnabled({ [KONJAKU_FEATURE_FLAG]: value }, KONJAKU_FEATURE_FLAG)).toBe(
        false,
      );
    }
  });
});

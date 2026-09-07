import { describe, expect, it } from "vitest";

import {
  GENERATED_END,
  GENERATED_START,
  LICENSE_CHECKER_COMMAND,
  filterProductionPackages,
  formatLicenseSummary,
  formatPackageTable,
  productionPackageKeys,
  replaceGeneratedSection,
  resolveGeneratedDate,
} from "../../../scripts/update-third-party-notices.mjs";

describe("update-third-party-notices", () => {
  it("records the pinned local license-checker binary", () => {
    expect(LICENSE_CHECKER_COMMAND).toBe("./node_modules/.bin/license-checker");
  });

  it("formats production packages and excludes the private application", () => {
    const table = formatPackageTable({
      "chronomap@0.1.0": { private: true, licenses: "UNLICENSED" },
      "@scope/package@2.0.0": {
        licenses: "MIT | BSD-3-Clause",
        repository: { url: "https://example.test/package" },
      },
      "plain-package@1.0.0": { licenses: "ISC" },
    });

    expect(table).not.toContain("chronomap");
    expect(table).toContain("@scope/package | 2.0.0");
    expect(table).toContain("MIT \\| BSD-3-Clause");
    expect(table).toContain("plain-package  | 1.0.0");
  });

  it("selects root and workspace production packages from the lockfile", () => {
    const keys = productionPackageKeys({
      packages: {
        "": { name: "chronomap", version: "0.1.0" },
        "apps/mobile": { name: "@chronomap/mobile", version: "0.1.0" },
        "node_modules/expo": { version: "57.0.15" },
        "node_modules/vitest": { name: "vitest", version: "4.1.10", dev: true },
        "node_modules/workspace-link": { link: true },
      },
    });
    const filtered = filterProductionPackages(
      {
        "expo@57.0.15": { licenses: "MIT" },
        "vitest@4.1.10": { licenses: "MIT" },
      },
      keys,
    );

    expect(keys).toContain("@chronomap/mobile@0.1.0");
    expect(filtered).toEqual({ "expo@57.0.15": { licenses: "MIT" } });
  });

  it("summarizes filtered package licenses deterministically", () => {
    expect(
      formatLicenseSummary({
        "a@1.0.0": { licenses: "MIT" },
        "b@1.0.0": { licenses: "ISC" },
        "c@1.0.0": { licenses: "MIT" },
      }),
    ).toBe("├─ MIT: 2\n└─ ISC: 1");
  });

  it("replaces only the marked generated section", () => {
    const document = `before\n${GENERATED_START}\nold\n${GENERATED_END}\nafter`;

    expect(replaceGeneratedSection(document, "new")).toBe(
      `before\n${GENERATED_START}\n\nnew\n\n${GENERATED_END}\nafter`,
    );
  });

  it("uses a reproducible date without depending on the machine locale or clock", () => {
    const document = "Generated from the production dependency tree on 2026-08-23.";

    expect(resolveGeneratedDate(document, "0")).toBe("1970-01-01");
    expect(resolveGeneratedDate(document, undefined)).toBe("2026-08-23");
    expect(resolveGeneratedDate("no generated date", undefined)).toBe("1970-01-01");
  });
});

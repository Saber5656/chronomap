import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  extractMarkdownLinks,
  validateMarkdownLinks,
} from "../../../scripts/validate-readme-links.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("README link validation", () => {
  it("finds no broken local links in the checked-in README", async () => {
    const readme = await readFile(resolve(repositoryRoot, "README.md"), "utf8");
    const result = validateMarkdownLinks(readme, { baseDir: repositoryRoot });

    expect(result.checked).toBeGreaterThan(20);
    expect(result.broken).toEqual([]);
  });

  it("keeps external links out of local path validation", () => {
    const markdown = "[local](docs/README.md) [web](https://example.test/a)";
    const links = extractMarkdownLinks(markdown);
    const result = validateMarkdownLinks(markdown, { baseDir: repositoryRoot });

    expect(links).toEqual(["docs/README.md", "https://example.test/a"]);
    expect(result.broken).toEqual([]);
  });

  it("reports a missing local target", () => {
    const result = validateMarkdownLinks("[missing](docs/not-present.md)", {
      baseDir: repositoryRoot,
    });

    expect(result.broken).toHaveLength(1);
    expect(result.broken[0]?.target).toBe("docs/not-present.md");
  });
});

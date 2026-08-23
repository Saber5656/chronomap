import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(import.meta.dirname, "../../../src");
const ALLOWED_FILES = new Set(["providers/poi/wikimediaClient.ts"]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:m?[jt]sx?)$/u.test(entry.name) ? [path] : [];
  });
}

describe("network access boundaries", () => {
  it("keeps raw fetch calls behind the Wikimedia client boundary", () => {
    const offenders = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const relativePath = relative(SOURCE_ROOT, path);
      if (ALLOWED_FILES.has(relativePath)) return [];
      const source = readFileSync(path, "utf8");
      const sourceFile = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      let hasRawFetch = false;
      const visit = (node) => {
        if (hasRawFetch) return;
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          hasRawFetch =
            (ts.isIdentifier(expression) && expression.text === "fetch") ||
            (ts.isPropertyAccessExpression(expression) &&
              expression.name.text === "fetch" &&
              expression.expression.getText(sourceFile) === "globalThis");
        }
        if (!hasRawFetch) ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return hasRawFetch ? [relativePath] : [];
    });

    expect(offenders).toEqual([]);
  });
});

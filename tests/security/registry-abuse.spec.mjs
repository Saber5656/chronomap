import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const validator = resolve(repositoryRoot, "scripts/validate-registry.mjs");
const validFixture = resolve(repositoryRoot, "tests/unit/fixtures/registry/valid.layers.json");
const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(resolve(tmpdir(), "chronomap-security-registry-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("security abuse boundary: layer registry", () => {
  it("A7 exits non-zero when a temp registry introduces an evil tile host", async () => {
    const directory = await temporaryDirectory();
    const registryPath = resolve(directory, "hostile.layers.json");
    const document = JSON.parse(await readFile(validFixture, "utf8"));
    document[0].tiles.urlTemplate = "https://evil.example/{z}/{x}/{y}.png";
    await writeFile(registryPath, JSON.stringify(document), "utf8");

    let result;
    try {
      const completed = await execFileAsync(process.execPath, [validator, registryPath], {
        cwd: repositoryRoot,
        encoding: "utf8",
      });
      result = { code: 0, stdout: completed.stdout, stderr: completed.stderr };
    } catch (cause) {
      result = {
        code: cause.code,
        stdout: cause.stdout ?? "",
        stderr: cause.stderr ?? String(cause),
      };
    }

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("evil.example");
    expect(result.stdout).toBe("");
  });
});

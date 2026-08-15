import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertSchemaContract,
  discoverRegistryFiles,
  validateRegistryDocument,
} from "../../../scripts/validate-registry.mjs";

const execFileAsync = promisify(execFile);
const fixture = (name) => resolve("tests/unit/fixtures/registry", name);
const script = resolve("scripts/validate-registry.mjs");
const allowedHosts = new Set(["cyberjapandata.gsi.go.jp", "ktgis.net"]);
const temporaryDirectories = [];

async function validDocument() {
  const document = JSON.parse(await readFile(fixture("valid.layers.json"), "utf8"));
  return [document[0]];
}

async function temporaryDirectory() {
  const directory = await mkdtemp(resolve(tmpdir(), "chronomap-registry-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function run(args) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], { encoding: "utf8" });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (cause) {
    return {
      code: cause.code,
      stdout: cause.stdout ?? "",
      stderr: cause.stderr ?? String(cause),
    };
  }
}

describe("validate-registry CLI", () => {
  it("accepts the committed valid table including rolling and vector entries", async () => {
    const result = await run([fixture("valid.layers.json")]);

    expect(result).toEqual(expect.objectContaining({ code: 0 }));
    expect(result.stdout).toContain("Validated 1 layer registry file(s).");
  });

  it("keeps schema URL patterns aligned with validator lexical rules", async () => {
    const schema = JSON.parse(
      await readFile(resolve("src/providers/layers/registry.schema.json"), "utf8"),
    );
    const httpsPattern = new RegExp(schema.$defs.httpsUrl.pattern);
    const tilePattern = new RegExp(schema.$defs.tileUrlTemplate.pattern);
    const canonicalTile = "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png";

    expect(httpsPattern.test("https://example.com/terms")).toBe(true);
    expect(httpsPattern.test("https://example.com:8443/terms")).toBe(true);
    expect(httpsPattern.test("HTTPS://example.com/terms")).toBe(false);
    expect(httpsPattern.test("https://user@example.com/terms")).toBe(false);
    expect(httpsPattern.test("https://example.com/terms ")).toBe(false);
    expect(httpsPattern.test("https://example.com/a\u00a0b")).toBe(false);
    expect(tilePattern.test(canonicalTile)).toBe(true);
    expect(tilePattern.test(` ${canonicalTile}`)).toBe(false);
    expect(tilePattern.test(canonicalTile.replace("https://", "HTTPS://"))).toBe(false);
    expect(tilePattern.test(canonicalTile.replace(".go.jp/", ".go.jp:443/"))).toBe(false);
    expect(tilePattern.test(canonicalTile.replace("https://", "https:////"))).toBe(false);
    expect(tilePattern.test("https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}#{y}")).toBe(false);
    expect(tilePattern.test("https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}?row={y}")).toBe(false);
    expect(tilePattern.test(`${canonicalTile}#`)).toBe(false);
    expect(tilePattern.test(`${canonicalTile}?`)).toBe(false);
    expect(tilePattern.test("https://cyberjapandata.gsi.go.jp?z={z}&x={x}&y={y}")).toBe(false);
    expect(tilePattern.test("https://cyberjapandata.gsi.go.jp#{z}{x}{y}")).toBe(false);
  });

  it("aggregates all named structural and semantic violations", async () => {
    const result = await run([fixture("invalid.layers.json")]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("evil.example");
    expect(result.stderr).toContain("duplicate id duplicate-id");
    expect(result.stderr).toContain("title.ja");
    expect(result.stderr).toContain("attribution.license.name");
    expect(result.stderr).toContain("tiles.scheme");
    expect(result.stderr).toContain("tiles.minzoom");
    expect(result.stderr).toContain("coordinates are outside");
    expect(result.stderr).toContain("unknown field");
    expect(result.stderr).toContain("required field is missing");
  });

  it.each([
    ["bad id", (entry) => (entry.id = "BAD ID"), "id"],
    ["inverted era", (entry) => (entry.era = { from: 2021, to: 2020 }), "era"],
    ["five-value bbox", (entry) => (entry.coverage = [[0, 0, 1, 1, 2]]), "coverage[0]"],
    ["out-of-range bbox", (entry) => (entry.coverage = [[-181, 0, 1, 1]]), "coverage[0]"],
    ["inverted bbox", (entry) => (entry.coverage = [[1, 1, 0, 0]]), "coverage[0]"],
    [
      "evil host",
      (entry) => (entry.tiles.urlTemplate = "https://evil.example/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    ["missing Japanese title", (entry) => delete entry.title.ja, "title.ja"],
    [
      "missing license name",
      (entry) => delete entry.attribution.license.name,
      "attribution.license.name",
    ],
    ["bad scheme", (entry) => (entry.tiles.scheme = "quadkey"), "tiles.scheme"],
    ["fractional zoom", (entry) => (entry.tiles.minzoom = 1.5), "tiles.minzoom"],
    ["out-of-range zoom", (entry) => (entry.tiles.maxzoom = 23), "tiles.maxzoom"],
    [
      "ordered integer zoom violation",
      (entry) => Object.assign(entry.tiles, { minzoom: 12, maxzoom: 11 }),
      "tiles.zoom",
    ],
    ["missing required provider", (entry) => delete entry.provider, "provider"],
    [
      "explicit default tile port",
      (entry) =>
        (entry.tiles.urlTemplate = "https://cyberjapandata.gsi.go.jp:443/xyz/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    [
      "explicit alternate tile port",
      (entry) =>
        (entry.tiles.urlTemplate = "https://cyberjapandata.gsi.go.jp:8443/xyz/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    [
      "leading whitespace tile URL",
      (entry) =>
        (entry.tiles.urlTemplate = " https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    [
      "uppercase tile scheme spelling",
      (entry) => (entry.tiles.urlTemplate = "HTTPS://cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    [
      "extra slash tile spelling",
      (entry) =>
        (entry.tiles.urlTemplate = "https:////cyberjapandata.gsi.go.jp:8443/xyz/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    [
      "control in tile scheme",
      (entry) =>
        (entry.tiles.urlTemplate = "h\tttps://cyberjapandata.gsi.go.jp:8443/xyz/{z}/{x}/{y}.png"),
      "tiles.urlTemplate",
    ],
    [
      "tile token in URL fragment",
      (entry) => (entry.tiles.urlTemplate = "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}#{y}"),
      "tiles.urlTemplate",
    ],
    [
      "tile token in URL query",
      (entry) => (entry.tiles.urlTemplate = "https://cyberjapandata.gsi.go.jp/xyz/{z}/{x}?row={y}"),
      "tiles.urlTemplate",
    ],
    [
      "bare URL fragment delimiter",
      (entry) => (entry.tiles.urlTemplate += "#"),
      "tiles.urlTemplate",
    ],
    ["bare URL query delimiter", (entry) => (entry.tiles.urlTemplate += "?"), "tiles.urlTemplate"],
    [
      "non-HTTPS attribution",
      (entry) => (entry.attribution.url = "http://example.com"),
      "attribution.url",
    ],
    [
      "whitespace attribution URL",
      (entry) => (entry.attribution.url = "https://example.com "),
      "attribution.url",
    ],
    [
      "uppercase license URL scheme",
      (entry) => (entry.attribution.license.url = "HTTPS://example.com/license"),
      "attribution.license.url",
    ],
    [
      "Unicode whitespace attribution URL",
      (entry) => (entry.attribution.url = "https://example.com/a\u00a0b"),
      "attribution.url",
    ],
    ["unknown nested field", (entry) => (entry.title.extra = "reject"), "title.extra"],
  ])("rejects %s independently", async (_name, mutate, expectedField) => {
    const document = await validDocument();
    mutate(document[0]);

    const errors = validateRegistryDocument(document, allowedHosts, "case.layers.json");

    expect(errors.some((validationError) => validationError.field === expectedField)).toBe(true);
  });

  it("rejects duplicate ids across separate registry files", async () => {
    const path = fixture("valid.layers.json");
    const result = await run([path, path]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("duplicate id valid-raster");
    expect(result.stderr).toContain("first declared at");
  });

  it("rejects rolling eras that start after the validator current year", async () => {
    const document = await validDocument();
    document[0].era = { from: 2026, to: null };

    const boundaryErrors = validateRegistryDocument(
      document,
      allowedHosts,
      "future-rolling.layers.json",
      new Map(),
      2026,
    );
    document[0].era.from = 2027;
    const futureErrors = validateRegistryDocument(
      document,
      allowedHosts,
      "future-rolling.layers.json",
      new Map(),
      2026,
    );

    expect(boundaryErrors).toEqual([]);
    expect(futureErrors).toEqual([expect.objectContaining({ field: "era" })]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2026.5])(
    "fails closed when the injected validator current year is not an integer (%s)",
    async (currentYear) => {
      const document = await validDocument();

      const errors = validateRegistryDocument(
        document,
        allowedHosts,
        "bad-current-year.layers.json",
        new Map(),
        currentYear,
      );

      expect(errors).toEqual([
        expect.objectContaining({ field: "currentYear", reason: "must be an integer" }),
      ]);
    },
  );

  it("requires the Konjaku feature flag for every ktgis.net entry", async () => {
    const document = await validDocument();
    document[0].tiles.urlTemplate = "https://ktgis.net/kjmapw/{z}/{x}/{y}.png";

    const ungatedErrors = validateRegistryDocument(document, allowedHosts, "konjaku.layers.json");
    document[0].flags.requiresFeatureFlag = "VITE_ENABLE_OTHER";
    const wronglyGatedErrors = validateRegistryDocument(
      document,
      allowedHosts,
      "konjaku.layers.json",
    );

    expect(ungatedErrors).toEqual([
      expect.objectContaining({
        field: "flags.requiresFeatureFlag",
        reason: "ktgis.net tiles must require VITE_ENABLE_KONJAKU",
      }),
    ]);
    expect(wronglyGatedErrors).toEqual([
      expect.objectContaining({ field: "flags.requiresFeatureFlag" }),
    ]);
  });

  it("fails closed for malformed registry JSON", async () => {
    const result = await run([fixture("malformed.json")]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("malformed.json[-1].file");
    expect(result.stderr).toContain("invalid JSON");
    expect(result.stderr).not.toContain("not-closed");
  });

  it("rejects a non-array registry root", async () => {
    const result = await run([fixture("non-array.json")]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("registry: root must be an array");
  });

  it("uses exact host matching rather than suffix matching", async () => {
    const document = JSON.parse(await readFile(fixture("valid.layers.json"), "utf8"));
    document[0].tiles.urlTemplate = "https://evil.cyberjapandata.gsi.go.jp/xyz/{z}/{x}/{y}.png";

    const errors = validateRegistryDocument(document, allowedHosts, "suffix-spoof.layers.json");

    expect(errors).toEqual([
      expect.objectContaining({
        field: "tiles.urlTemplate",
        reason: "host evil.cyberjapandata.gsi.go.jp is not allowlisted",
      }),
    ]);
  });

  it("bounds an unknown-host diagnostic", async () => {
    const document = await validDocument();
    document[0].tiles.urlTemplate = `https://${"a".repeat(200)}.example/{z}/{x}/{y}.png`;

    const errors = validateRegistryDocument(document, allowedHosts, "bounded.layers.json");
    const hostError = errors.find((validationError) =>
      validationError.reason.includes("allowlisted"),
    );

    expect(hostError?.reason.length).toBeLessThanOrEqual(150);
    expect(hostError?.reason).toContain("...");
  });

  it("fails closed for a malformed allowlist", async () => {
    const result = await run([
      "--allowlist",
      fixture("malformed-allowlist.json"),
      fixture("valid.layers.json"),
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("allowlist must be a non-empty array");
  });

  it("rejects registry, canonical schema contract, and allowlist symlinks", async () => {
    const directory = await temporaryDirectory();
    const registryLink = resolve(directory, "linked.layers.json");
    const schemaLink = resolve(directory, "schema.json");
    const allowlistLink = resolve(directory, "allowed-hosts.json");
    await symlink(fixture("valid.layers.json"), registryLink);
    await symlink(resolve("src/providers/layers/registry.schema.json"), schemaLink);
    await symlink(resolve("src/providers/layers/allowed-hosts.json"), allowlistLink);

    const registryResult = await run([registryLink]);
    const allowlistResult = await run(["--allowlist", allowlistLink, fixture("valid.layers.json")]);

    expect(registryResult.stderr).toContain("is not a regular file");
    await expect(assertSchemaContract(schemaLink)).rejects.toThrow("is not a regular file");
    expect(allowlistResult.stderr).toContain("is not a regular file");
  });

  it("rejects custom schema options instead of pretending to apply them", async () => {
    const result = await run(["--schema", fixture("non-array.json"), fixture("valid.layers.json")]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("unknown option --schema");
    expect(result.stdout).toBe("");
  });

  it("fails default discovery when a matching entry is not a regular file", async () => {
    const directory = await temporaryDirectory();
    await symlink(fixture("valid.layers.json"), resolve(directory, "linked.layers.json"));

    await expect(discoverRegistryFiles(directory)).rejects.toThrow("is not a regular file");
  });
});

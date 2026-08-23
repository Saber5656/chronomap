#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const LICENSE_CHECKER_VERSION = "25.0.1";
export const LICENSE_CHECKER_COMMAND = "./node_modules/.bin/license-checker";
export const GENERATED_START = "<!-- license-checker:production:start -->";
export const GENERATED_END = "<!-- license-checker:production:end -->";
export const DEFAULT_GENERATED_DATE = "1970-01-01";

const execFileAsync = promisify(execFile);
const MODULE_PATH = import.meta.url.startsWith("file:") ? fileURLToPath(import.meta.url) : null;
const repositoryRoot =
  MODULE_PATH === null ? resolve(process.cwd()) : resolve(dirname(MODULE_PATH), "..");
const noticesPath = resolve(repositoryRoot, "THIRD_PARTY_NOTICES.md");
const licenseCheckerBinary = resolve(
  repositoryRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "license-checker.cmd" : "license-checker",
);

function packageParts(packageKey) {
  const separator = packageKey.lastIndexOf("@");
  if (separator <= 0) return { name: packageKey, version: "unknown" };
  return { name: packageKey.slice(0, separator), version: packageKey.slice(separator + 1) };
}

function escapeTableCell(value) {
  return String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/gu, " ");
}

export function formatPackageTable(packages) {
  const rows = Object.entries(packages)
    .filter(([, metadata]) => metadata?.private !== true)
    .map(([packageKey, metadata]) => {
      const { name, version } = packageParts(packageKey);
      const repository =
        typeof metadata.repository === "string"
          ? metadata.repository
          : typeof metadata.repository?.url === "string"
            ? metadata.repository.url
            : "—";
      return [name, version, metadata.licenses ?? "UNKNOWN", repository];
    })
    .map((row) => row.map(escapeTableCell))
    .sort(([leftName, leftVersion], [rightName, rightVersion]) => {
      const leftKey = `${leftName}@${leftVersion}`;
      const rightKey = `${rightName}@${rightVersion}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

  const header = ["Package", "Version", "License", "Repository"];
  const widths = header.map((value, index) =>
    Math.max(value.length, ...rows.map((row) => row[index].length)),
  );
  const formatRow = (row) =>
    `| ${row.map((value, index) => value.padEnd(widths[index], " ")).join(" | ")} |`;
  const separator = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
  const lines = [formatRow(header), separator, ...rows.map(formatRow)];
  return lines.join("\n");
}

export function replaceGeneratedSection(document, replacement) {
  const start = document.indexOf(GENERATED_START);
  const end = document.indexOf(GENERATED_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("THIRD_PARTY_NOTICES.md is missing license-checker generation markers.");
  }
  const afterEnd = end + GENERATED_END.length;
  return `${document.slice(0, start)}${GENERATED_START}\n\n${replacement}\n\n${GENERATED_END}${document.slice(afterEnd)}`;
}

function dateFromSourceDateEpoch(sourceDateEpoch) {
  if (sourceDateEpoch === undefined) return null;
  if (!/^\d+$/u.test(sourceDateEpoch)) {
    throw new Error("SOURCE_DATE_EPOCH must be a non-negative integer.");
  }
  const timestamp = Number(sourceDateEpoch);
  const date = new Date(timestamp * 1000);
  if (!Number.isSafeInteger(timestamp) || !Number.isFinite(date.getTime())) {
    throw new Error("SOURCE_DATE_EPOCH is outside the supported date range.");
  }
  return date.toISOString().slice(0, 10);
}

export function resolveGeneratedDate(document, sourceDateEpoch = process.env.SOURCE_DATE_EPOCH) {
  const reproducibleDate = dateFromSourceDateEpoch(sourceDateEpoch);
  if (reproducibleDate !== null) return reproducibleDate;

  const existingDate = document.match(
    /^Generated from the production dependency tree on (\d{4}-\d{2}-\d{2})\.$/mu,
  )?.[1];
  return existingDate ?? DEFAULT_GENERATED_DATE;
}

async function runLicenseChecker(args) {
  try {
    const result = await execFileAsync(licenseCheckerBinary, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    return result.stdout.trim();
  } catch (cause) {
    const detail = cause?.stderr?.trim() || cause?.message || String(cause);
    throw new Error(`license-checker failed: ${detail}`, { cause });
  }
}

function generatedContent(summary, packages, generatedDate = DEFAULT_GENERATED_DATE) {
  return [
    `Generated from the production dependency tree on ${generatedDate}.`,
    "",
    "Summary command (the summary includes the private application package as `UNLICENSED`):",
    "",
    "```text",
    summary,
    "```",
    "",
    "The package table uses the corresponding JSON command and excludes the private application package:",
    "",
    "```sh",
    `${LICENSE_CHECKER_COMMAND} --production --summary`,
    `${LICENSE_CHECKER_COMMAND} --production --json --excludePrivatePackages`,
    "```",
    "",
    formatPackageTable(packages),
  ].join("\n");
}

export async function generateNotices() {
  const current = await readFile(noticesPath, "utf8");
  const summary = await runLicenseChecker(["--production", "--summary"]);
  const json = await runLicenseChecker(["--production", "--json", "--excludePrivatePackages"]);
  const packages = JSON.parse(json);
  const generatedDate = resolveGeneratedDate(current);
  const updated = replaceGeneratedSection(
    current,
    generatedContent(summary, packages, generatedDate),
  );
  if (updated !== current) await writeFile(noticesPath, updated, "utf8");
  return { changed: updated !== current, packageCount: Object.keys(packages).length, summary };
}

export async function main() {
  const result = await generateNotices();
  console.log(
    `${result.changed ? "Updated" : "Already current"} THIRD_PARTY_NOTICES.md (${result.packageCount} production packages).`,
  );
}

if (MODULE_PATH !== null && resolve(process.argv[1] ?? "") === resolve(MODULE_PATH)) {
  main().catch((error) => {
    console.error(
      `license notice refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}

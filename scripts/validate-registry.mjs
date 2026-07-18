#!/usr/bin/env node

import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const defaultRegistryDirectory = resolve(repositoryRoot, "src/providers/layers");
const defaultAllowlistPath = resolve(defaultRegistryDirectory, "allowed-hosts.json");
const defaultSchemaPath = resolve(defaultRegistryDirectory, "registry.schema.json");
const idPattern = /^[a-z0-9-]{1,64}$/;
const regionPattern = /^(?:[A-Z]{2}|GLOBAL)$/;

function error(file, index, field, reason) {
  return { file, index, field, reason };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlank(value) {
  return typeof value === "string" && /\S/u.test(value);
}

function canonicalHttpsSpelling(value) {
  return value.startsWith("https://") && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function tileAuthority(value) {
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/u.exec(value);
  return match?.[1] ?? null;
}

function boundedHost(host) {
  return host.length <= 120 ? host : `${host.slice(0, 117)}...`;
}

function checkKeys(errors, file, index, field, value, allowed) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(error(file, index, field === "" ? key : `${field}.${key}`, "unknown field"));
    }
  }
}

function checkRequiredKeys(errors, file, index, field, value, required) {
  if (!isRecord(value)) return;
  for (const key of required) {
    if (!(key in value)) {
      errors.push(
        error(file, index, field === "" ? key : `${field}.${key}`, "required field is missing"),
      );
    }
  }
}

function checkHttpsUrl(errors, file, index, field, value) {
  if (!isNonBlank(value)) {
    errors.push(error(file, index, field, "must be a non-blank HTTPS URL"));
    return null;
  }
  if (!canonicalHttpsSpelling(value)) {
    errors.push(
      error(
        file,
        index,
        field,
        "must use canonical lowercase https:// spelling without whitespace",
      ),
    );
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
      errors.push(error(file, index, field, "must use HTTPS without credentials"));
      return null;
    }
    return url;
  } catch {
    errors.push(error(file, index, field, "must be a valid HTTPS URL"));
    return null;
  }
}

function validateBbox(errors, file, index, bbox, bboxIndex) {
  const field = `coverage[${bboxIndex}]`;
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    errors.push(error(file, index, field, "must contain exactly four coordinates"));
    return;
  }
  if (!bbox.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) {
    errors.push(error(file, index, field, "coordinates must be finite numbers"));
    return;
  }
  const [minLng, minLat, maxLng, maxLat] = bbox;
  if (
    minLng < -180 ||
    minLng > 180 ||
    maxLng < -180 ||
    maxLng > 180 ||
    minLat < -90 ||
    minLat > 90 ||
    maxLat < -90 ||
    maxLat > 90
  ) {
    errors.push(error(file, index, field, "coordinates are outside longitude/latitude ranges"));
  }
  if (minLng >= maxLng || minLat >= maxLat) {
    errors.push(
      error(file, index, field, "minimum coordinates must be less than maximum coordinates"),
    );
  }
}

function validateEntry(entry, file, index, allowedHosts) {
  const errors = [];
  if (!isRecord(entry)) {
    return { errors: [error(file, index, "entry", "must be an object")], id: null };
  }

  const entryKeys = new Set([
    "id",
    "type",
    "provider",
    "title",
    "era",
    "region",
    "coverage",
    "tiles",
    "attribution",
    "flags",
    "priority",
  ]);
  checkKeys(errors, file, index, "", entry, entryKeys);
  checkRequiredKeys(errors, file, index, "", entry, entryKeys);

  const id = typeof entry.id === "string" && idPattern.test(entry.id) ? entry.id : null;
  if (id === null) errors.push(error(file, index, "id", "must match ^[a-z0-9-]{1,64}$"));
  if (entry.type !== "raster-era" && entry.type !== "vector-dated") {
    errors.push(error(file, index, "type", "must be raster-era or vector-dated"));
  }
  if (!isNonBlank(entry.provider)) errors.push(error(file, index, "provider", "must be non-blank"));

  if (!isRecord(entry.title)) {
    errors.push(error(file, index, "title", "must be an object"));
  } else {
    checkKeys(errors, file, index, "title", entry.title, new Set(["ja", "en"]));
    checkRequiredKeys(errors, file, index, "title", entry.title, new Set(["ja", "en"]));
    if (!isNonBlank(entry.title.ja))
      errors.push(error(file, index, "title.ja", "must be non-blank"));
    if (!isNonBlank(entry.title.en))
      errors.push(error(file, index, "title.en", "must be non-blank"));
  }

  if (!isRecord(entry.era)) {
    errors.push(error(file, index, "era", "must be an object"));
  } else {
    checkKeys(errors, file, index, "era", entry.era, new Set(["from", "to"]));
    checkRequiredKeys(errors, file, index, "era", entry.era, new Set(["from", "to"]));
    if (!Number.isInteger(entry.era.from))
      errors.push(error(file, index, "era.from", "must be an integer"));
    if (!(entry.era.to === null || Number.isInteger(entry.era.to))) {
      errors.push(error(file, index, "era.to", "must be an integer or null"));
    } else if (
      Number.isInteger(entry.era.from) &&
      entry.era.to !== null &&
      entry.era.from > entry.era.to
    ) {
      errors.push(error(file, index, "era", "from must be less than or equal to to"));
    }
  }

  if (typeof entry.region !== "string" || !regionPattern.test(entry.region)) {
    errors.push(error(file, index, "region", "must be GLOBAL or an uppercase ISO alpha-2 code"));
  }

  if (!Array.isArray(entry.coverage) || entry.coverage.length === 0) {
    errors.push(error(file, index, "coverage", "must contain at least one bounding box"));
  } else {
    entry.coverage.forEach((bbox, bboxIndex) => validateBbox(errors, file, index, bbox, bboxIndex));
  }

  if (!isRecord(entry.tiles)) {
    errors.push(error(file, index, "tiles", "must be an object"));
  } else {
    const tileKeys = new Set(["urlTemplate", "scheme", "minzoom", "maxzoom", "tileSize"]);
    checkKeys(errors, file, index, "tiles", entry.tiles, tileKeys);
    checkRequiredKeys(errors, file, index, "tiles", entry.tiles, tileKeys);
    const authority =
      typeof entry.tiles.urlTemplate === "string" ? tileAuthority(entry.tiles.urlTemplate) : null;
    const canonicalTileUrl =
      typeof entry.tiles.urlTemplate === "string" &&
      canonicalHttpsSpelling(entry.tiles.urlTemplate) &&
      authority !== null &&
      !authority.includes(":");
    if (typeof entry.tiles.urlTemplate === "string" && !canonicalTileUrl) {
      errors.push(
        error(
          file,
          index,
          "tiles.urlTemplate",
          "must use canonical lowercase HTTPS without whitespace, credentials, or an explicit port",
        ),
      );
    }
    const tileUrl = canonicalTileUrl
      ? checkHttpsUrl(errors, file, index, "tiles.urlTemplate", entry.tiles.urlTemplate)
      : typeof entry.tiles.urlTemplate === "string"
        ? null
        : checkHttpsUrl(errors, file, index, "tiles.urlTemplate", entry.tiles.urlTemplate);
    if (tileUrl !== null && typeof entry.tiles.urlTemplate === "string") {
      if (!allowedHosts.has(tileUrl.hostname)) {
        errors.push(
          error(
            file,
            index,
            "tiles.urlTemplate",
            `host ${boundedHost(tileUrl.hostname)} is not allowlisted`,
          ),
        );
      }
      if (!["{z}", "{x}", "{y}"].every((token) => entry.tiles.urlTemplate.includes(token))) {
        errors.push(error(file, index, "tiles.urlTemplate", "must contain {z}, {x}, and {y}"));
      }
    }
    if (entry.tiles.scheme !== "xyz" && entry.tiles.scheme !== "tms") {
      errors.push(error(file, index, "tiles.scheme", "must be xyz or tms"));
    }
    if (
      !Number.isInteger(entry.tiles.minzoom) ||
      entry.tiles.minzoom < 0 ||
      entry.tiles.minzoom > 22
    ) {
      errors.push(error(file, index, "tiles.minzoom", "must be an integer in 0..22"));
    }
    if (
      !Number.isInteger(entry.tiles.maxzoom) ||
      entry.tiles.maxzoom < 0 ||
      entry.tiles.maxzoom > 22
    ) {
      errors.push(error(file, index, "tiles.maxzoom", "must be an integer in 0..22"));
    }
    if (
      Number.isInteger(entry.tiles.minzoom) &&
      Number.isInteger(entry.tiles.maxzoom) &&
      entry.tiles.minzoom > entry.tiles.maxzoom
    ) {
      errors.push(
        error(file, index, "tiles.zoom", "minzoom must be less than or equal to maxzoom"),
      );
    }
    if (entry.tiles.tileSize !== 256 && entry.tiles.tileSize !== 512) {
      errors.push(error(file, index, "tiles.tileSize", "must be 256 or 512"));
    }
  }

  if (!isRecord(entry.attribution)) {
    errors.push(error(file, index, "attribution", "must be an object"));
  } else {
    const attributionKeys = new Set(["text", "url", "license"]);
    checkKeys(errors, file, index, "attribution", entry.attribution, attributionKeys);
    checkRequiredKeys(
      errors,
      file,
      index,
      "attribution",
      entry.attribution,
      new Set(["text", "license"]),
    );
    if (!isNonBlank(entry.attribution.text)) {
      errors.push(error(file, index, "attribution.text", "must be non-blank"));
    }
    if (entry.attribution.url !== undefined) {
      checkHttpsUrl(errors, file, index, "attribution.url", entry.attribution.url);
    }
    if (!isRecord(entry.attribution.license)) {
      errors.push(error(file, index, "attribution.license", "must be an object"));
    } else {
      checkKeys(
        errors,
        file,
        index,
        "attribution.license",
        entry.attribution.license,
        new Set(["name", "url"]),
      );
      checkRequiredKeys(
        errors,
        file,
        index,
        "attribution.license",
        entry.attribution.license,
        new Set(["name"]),
      );
      if (!isNonBlank(entry.attribution.license.name)) {
        errors.push(error(file, index, "attribution.license.name", "must be non-blank"));
      }
      if (entry.attribution.license.url !== undefined) {
        checkHttpsUrl(
          errors,
          file,
          index,
          "attribution.license.url",
          entry.attribution.license.url,
        );
      }
    }
  }

  if (!isRecord(entry.flags)) {
    errors.push(error(file, index, "flags", "must be an object"));
  } else {
    checkKeys(
      errors,
      file,
      index,
      "flags",
      entry.flags,
      new Set(["experimental", "requiresFeatureFlag"]),
    );
    checkRequiredKeys(
      errors,
      file,
      index,
      "flags",
      entry.flags,
      new Set(["experimental", "requiresFeatureFlag"]),
    );
    if (typeof entry.flags.experimental !== "boolean") {
      errors.push(error(file, index, "flags.experimental", "must be a boolean"));
    }
    if (!(
      entry.flags.requiresFeatureFlag === null || isNonBlank(entry.flags.requiresFeatureFlag)
    )) {
      errors.push(
        error(file, index, "flags.requiresFeatureFlag", "must be a non-blank string or null"),
      );
    }
  }
  if (!Number.isInteger(entry.priority))
    errors.push(error(file, index, "priority", "must be an integer"));
  return { errors, id };
}

export function validateRegistryDocument(
  document,
  allowedHosts,
  file = "<memory>",
  seenIds = new Map(),
) {
  if (!Array.isArray(document)) {
    return [error(file, -1, "registry", "root must be an array")];
  }
  const errors = [];
  for (const [index, entry] of document.entries()) {
    const result = validateEntry(entry, file, index, allowedHosts);
    errors.push(...result.errors);
    if (result.id !== null) {
      const firstLocation = seenIds.get(result.id);
      if (firstLocation !== undefined) {
        errors.push(
          error(file, index, "id", `duplicate id ${result.id}; first declared at ${firstLocation}`),
        );
      } else {
        seenIds.set(result.id, `${file}[${index}]`);
      }
    }
  }
  return errors;
}

async function parseJsonFile(path) {
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid JSON");
  }
}

async function loadAllowlist(path) {
  await assertRegularFile(path);
  const value = await parseJsonFile(path);
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (host) =>
        typeof host !== "string" ||
        host === "" ||
        host !== host.toLowerCase() ||
        /[:/]/u.test(host),
    )
  ) {
    throw new Error("allowlist must be a non-empty array of lowercase hostnames without ports");
  }
  if (new Set(value).size !== value.length) throw new Error("allowlist contains duplicate hosts");
  return new Set(value);
}

async function loadSchema(path) {
  await assertRegularFile(path);
  const value = await parseJsonFile(path);
  if (!isRecord(value) || value.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("schema must declare JSON Schema draft 2020-12");
  }
}

async function assertRegularFile(path) {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${path} is not a regular file`);
  }
}

export async function discoverRegistryFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const invalidEntry = entries.find(
    (entry) => entry.name.endsWith(".layers.json") && !entry.isFile(),
  );
  if (invalidEntry !== undefined) {
    throw new Error(`${resolve(directory, invalidEntry.name)} is not a regular file`);
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".layers.json"))
    .map((entry) => resolve(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function parseArguments(args) {
  const files = [];
  let allowlistPath = defaultAllowlistPath;
  let schemaPath = defaultSchemaPath;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--allowlist" || argument === "--schema") {
      const value = args[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a path`);
      if (argument === "--allowlist") allowlistPath = resolve(value);
      else schemaPath = resolve(value);
      index += 1;
    } else {
      files.push(resolve(argument));
    }
  }
  return { files, allowlistPath, schemaPath };
}

export async function runValidator(args = [], output = console) {
  let options;
  try {
    options = parseArguments(args);
    await loadSchema(options.schemaPath);
    const allowedHosts = await loadAllowlist(options.allowlistPath);
    const files =
      options.files.length > 0
        ? options.files
        : await discoverRegistryFiles(defaultRegistryDirectory);
    const errors = [];
    const seenIds = new Map();
    for (const file of files) {
      try {
        await assertRegularFile(file);
        const document = await parseJsonFile(file);
        errors.push(...validateRegistryDocument(document, allowedHosts, file, seenIds));
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        errors.push(error(file, -1, "file", reason));
      }
    }
    if (errors.length > 0) {
      for (const validationError of errors) {
        output.error(
          `${validationError.file}[${validationError.index}].${validationError.field}: ${validationError.reason}`,
        );
      }
      return 1;
    }
    output.log(`Validated ${files.length} layer registry file(s).`);
    return 0;
  } catch (cause) {
    output.error(cause instanceof Error ? cause.message : String(cause));
    return 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runValidator(process.argv.slice(2));
}

#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import packageJson from "../package.json" with { type: "json" };
import allowedTileHosts from "../src/providers/layers/allowed-hosts.json" with { type: "json" };

export const MAX_REQUESTS = 12;
export const REQUEST_INTERVAL_MS = 1_000;
export const REQUEST_TIMEOUT_MS = 8_000;
export const USER_AGENT = `chronomap/${packageJson.version} (+https://github.com/Saber5656/chronomap)`;
export const TOKYO_STATION = Object.freeze({ lat: 35.681236, lng: 139.767125 });

const POI_REQUEST_COUNT = 2;
const GEOSearch_RADIUS_METERS = 1_000;
const ALLOWED_TILE_HOSTS = new Set(allowedTileHosts);
const REGISTRY_RELATIVE_PATHS = [
  "src/providers/layers/gsi.layers.json",
  "src/providers/layers/konjaku.layers.json",
];
const MODULE_PATH = import.meta.url.startsWith("file:") ? fileURLToPath(import.meta.url) : null;
const SCRIPT_DIRECTORY =
  MODULE_PATH === null ? resolve(process.cwd(), "scripts") : dirname(MODULE_PATH);
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");

export class SmokeError extends Error {
  constructor(message, { rows = [], requestCount = 0, cause } = {}) {
    super(message, cause === undefined ? {} : { cause });
    this.name = "SmokeError";
    this.rows = rows;
    this.requestCount = requestCount;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnabled(entry, env) {
  const requiredFlag = entry.flags?.requiresFeatureFlag;
  return requiredFlag === null || requiredFlag === undefined || env[requiredFlag] === "true";
}

export async function loadEnabledLayers({
  env = process.env,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
} = {}) {
  const layers = [];
  for (const relativePath of REGISTRY_RELATIVE_PATHS) {
    const path = resolve(repositoryRoot, relativePath);
    const document = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(document)) {
      throw new SmokeError(`Layer registry must be an array: ${relativePath}`);
    }
    for (const entry of document) {
      if (!isRecord(entry) || typeof entry.id !== "string") {
        throw new SmokeError(`Layer registry contains an invalid entry: ${relativePath}`);
      }
      if (isEnabled(entry, env)) layers.push(entry);
    }
  }
  return layers;
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function createRateLimiter({ intervalMs, now, sleepFn }) {
  let nextRequestAt = 0;
  return async function waitForSlot() {
    const waitMs = Math.max(0, nextRequestAt - now());
    if (waitMs > 0) await sleepFn(waitMs);
    nextRequestAt = now() + intervalMs;
  };
}

function tileCoordinate(latitude, longitude, zoom, scheme) {
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const scale = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan((clampedLatitude * Math.PI) / 180)) / Math.PI) / 2) * scale,
  );
  const boundedX = Math.max(0, Math.min(scale - 1, x));
  const xyzY = Math.max(0, Math.min(scale - 1, y));
  const boundedY = scheme === "tms" ? scale - 1 - xyzY : xyzY;
  return { x: boundedX, y: boundedY };
}

function tileUrl(entry) {
  const template = entry.tiles?.urlTemplate;
  let parsedTemplate;
  try {
    parsedTemplate = new URL(template);
  } catch (cause) {
    throw new SmokeError(`Layer ${entry.id} has an invalid tile URL template.`, { cause });
  }
  if (parsedTemplate.protocol !== "https:" || !ALLOWED_TILE_HOSTS.has(parsedTemplate.hostname)) {
    throw new SmokeError(
      `Layer ${entry.id} tile host is not allowlisted: ${parsedTemplate.hostname || "unknown"}.`,
    );
  }
  const [west, south, east, north] = entry.coverage?.[0] ?? [];
  if (![west, south, east, north].every((value) => Number.isFinite(value))) {
    throw new SmokeError(`Layer ${entry.id} has no usable coverage bbox.`);
  }
  const latitude = (south + north) / 2;
  const longitude = (west + east) / 2;
  const zoom = entry.tiles.minzoom;
  const { x, y } = tileCoordinate(latitude, longitude, zoom, entry.tiles.scheme);
  return entry.tiles.urlTemplate
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}

function geosearchUrl() {
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${TOKYO_STATION.lat}|${TOKYO_STATION.lng}`,
    gsradius: String(GEOSearch_RADIUS_METERS),
    gslimit: "50",
    gsnamespace: "0",
    format: "json",
    origin: "*",
  }).toString();
  return url;
}

function summaryUrl() {
  const title = encodeURIComponent("Tokyo Station".replaceAll(" ", "_"));
  return new URL(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
}

function requestHeaders() {
  return {
    Accept: "application/json",
    "Api-User-Agent": USER_AGENT,
    "User-Agent": USER_AGENT,
  };
}

async function fetchAndValidateWithTimeout(fetchImpl, url, timeoutMs, validate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: requestHeaders(),
      signal: controller.signal,
    });
    return await validate(response);
  } finally {
    clearTimeout(timeout);
  }
}

function responseStatus(response) {
  return Number.isInteger(response?.status) ? response.status : null;
}

async function jsonResponse(response, target) {
  const status = responseStatus(response);
  if (status !== 200)
    throw new Error(`${target} returned HTTP ${status ?? "unknown"}; expected 200.`);
  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new Error(`${target} returned invalid JSON.`, { cause });
  }
  return payload;
}

function validateGeosearch(payload) {
  if (!isRecord(payload) || !isRecord(payload.query) || !Array.isArray(payload.query.geosearch)) {
    throw new Error("Tokyo Station geosearch response has no query.geosearch array.");
  }
  if (payload.query.geosearch.length === 0) {
    throw new Error("Tokyo Station geosearch returned no rows.");
  }
  return `HTTP 200; ${payload.query.geosearch.length} result(s)`;
}

function validateSummary(payload) {
  if (
    !isRecord(payload) ||
    typeof payload.title !== "string" ||
    typeof payload.extract !== "string"
  ) {
    throw new Error("Tokyo Station summary response is missing title or extract.");
  }
  return `HTTP 200; ${payload.title}`;
}

function validateTile(response) {
  const status = responseStatus(response);
  if (status === 200) return "HTTP 200";
  if (status === 404) return "HTTP 404 accepted (coverage/no-data logic)";
  throw new Error(`returned HTTP ${status ?? "unknown"}; expected 200 or 404.`);
}

function normalizeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function checkRequest({
  kind,
  target,
  url,
  validate,
  fetchImpl,
  timeoutMs,
  waitForSlot,
  rows,
  requestCount,
}) {
  await waitForSlot();
  requestCount.value += 1;
  try {
    const detail = await fetchAndValidateWithTimeout(fetchImpl, url, timeoutMs, validate);
    rows.push({ kind, target, status: "PASS", detail });
  } catch (cause) {
    const detail = normalizeError(cause);
    rows.push({ kind, target, status: "ERROR", detail });
    throw new SmokeError(`Aborted after first error at ${kind}:${target}: ${detail}`, {
      rows,
      requestCount: requestCount.value,
      cause,
    });
  }
}

export async function runSmoke({
  env = process.env,
  fetchImpl = globalThis.fetch,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  registries,
  intervalMs = REQUEST_INTERVAL_MS,
  timeoutMs = REQUEST_TIMEOUT_MS,
  now = Date.now,
  sleepFn = sleep,
} = {}) {
  if (typeof fetchImpl !== "function")
    throw new SmokeError("This Node runtime has no fetch implementation.");
  const layers = registries ?? (await loadEnabledLayers({ env, repositoryRoot }));
  const plannedRequests = layers.length + POI_REQUEST_COUNT;
  if (plannedRequests > MAX_REQUESTS) {
    throw new SmokeError(
      `Refusing to run: ${layers.length} enabled layer tile requests plus ${POI_REQUEST_COUNT} POI requests would exceed the ${MAX_REQUESTS}-request budget. Keep permission-gated registries disabled for this smoke.`,
    );
  }

  const rows = [];
  const requestCount = { value: 0 };
  const waitForSlot = createRateLimiter({ intervalMs, now, sleepFn });
  const tileRequests = layers.map((entry) => ({ entry, url: tileUrl(entry) }));
  for (const { entry, url } of tileRequests) {
    await checkRequest({
      kind: "tile",
      target: entry.id,
      url,
      validate: validateTile,
      fetchImpl,
      timeoutMs,
      waitForSlot,
      rows,
      requestCount,
    });
  }

  await checkRequest({
    kind: "geosearch",
    target: "Tokyo Station",
    url: geosearchUrl(),
    validate: async (response) =>
      validateGeosearch(await jsonResponse(response, "Tokyo Station geosearch")),
    fetchImpl,
    timeoutMs,
    waitForSlot,
    rows,
    requestCount,
  });
  await checkRequest({
    kind: "summary",
    target: "Tokyo Station",
    url: summaryUrl(),
    validate: async (response) =>
      validateSummary(await jsonResponse(response, "Tokyo Station summary")),
    fetchImpl,
    timeoutMs,
    waitForSlot,
    rows,
    requestCount,
  });

  return { rows, requestCount: requestCount.value, enabledLayerCount: layers.length };
}

function tableCell(value, width) {
  return String(value).padEnd(width, " ");
}

export function renderTable(rows) {
  const headers = ["#", "Kind", "Target", "Status", "Detail"];
  const values = rows.map((row, index) => [
    index + 1,
    row.kind,
    row.target,
    row.status,
    row.detail,
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...values.map((row) => String(row[index]).length)),
  );
  const renderRow = (row) =>
    `| ${row.map((value, index) => tableCell(value, widths[index])).join(" | ")} |`;
  const separator = `|-${widths.map((width) => "-".repeat(width)).join("-|-")}-|`;
  return [renderRow(headers), separator, ...values.map(renderRow)].join("\n");
}

export async function main({
  env = process.env,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  if (env.CI) {
    stdout("smoke:providers skipped: CI environment detected; no live requests were made.");
    return 0;
  }

  try {
    const result = await runSmoke({ env });
    stdout(renderTable(result.rows));
    stdout(
      `smoke:providers passed: ${result.requestCount} request(s), ${result.enabledLayerCount} enabled layer(s).`,
    );
    return 0;
  } catch (error) {
    const rows = error instanceof SmokeError ? error.rows : [];
    if (rows.length > 0) stdout(renderTable(rows));
    stderr(`smoke:providers failed: ${normalizeError(error)}`);
    return 1;
  }
}

const invokedPath = process.argv[1] === undefined ? null : resolve(process.argv[1]);
if (MODULE_PATH !== null && invokedPath === resolve(MODULE_PATH)) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

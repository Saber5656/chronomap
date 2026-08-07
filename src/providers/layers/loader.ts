import allowedHostsJson from "./allowed-hosts.json";
import type {
  Bbox,
  LayerEntry,
  LayerType,
  RegistryEnv,
  RegistryWarning,
  TileScheme,
} from "./types";

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const REGION_PATTERN = /^(?:[A-Z]{2}|GLOBAL)$/;
const TILE_TYPES = new Set<LayerType>(["raster-era", "vector-dated"]);
const TILE_SCHEMES = new Set<TileScheme>(["xyz", "tms"]);
const KONJAKU_HOST = "ktgis.net";
const KONJAKU_FEATURE_FLAG = "VITE_ENABLE_KONJAKU";
const allowedHosts = new Set<string>(allowedHostsJson);

interface ParseSuccess {
  readonly entry: LayerEntry;
}

interface ParseFailure {
  readonly field: string;
  readonly reason: string;
}

type ParseResult = ParseSuccess | ParseFailure;

function isFailure(value: string | undefined | ParseFailure): value is ParseFailure {
  return typeof value === "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): value is string {
  return typeof value === "string" && /\S/u.test(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fail(field: string, reason: string): ParseFailure {
  return { field, reason };
}

function optionalHttpsUrl(value: unknown, field: string): string | undefined | ParseFailure {
  if (value === undefined) {
    return undefined;
  }
  if (!nonBlankString(value)) {
    return fail(field, "must be a non-blank HTTPS URL");
  }
  if (!canonicalHttpsSpelling(value)) {
    return fail(field, "must use canonical lowercase https:// spelling without whitespace");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
      return fail(field, "must be an HTTPS URL without credentials");
    }
    return value;
  } catch {
    return fail(field, "must be a valid HTTPS URL");
  }
}

function parseBbox(value: unknown, field: string): Bbox | ParseFailure {
  if (!Array.isArray(value) || value.length !== 4) {
    return fail(field, "must contain exactly four coordinates");
  }
  const coordinates = value as readonly unknown[];
  const minLng = coordinates[0];
  const minLat = coordinates[1];
  const maxLng = coordinates[2];
  const maxLat = coordinates[3];
  if (
    !finiteNumber(minLng) ||
    !finiteNumber(minLat) ||
    !finiteNumber(maxLng) ||
    !finiteNumber(maxLat)
  ) {
    return fail(field, "coordinates must be finite numbers");
  }
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
    return fail(field, "coordinates are outside longitude/latitude ranges");
  }
  if (minLng >= maxLng || minLat >= maxLat) {
    return fail(field, "minimum coordinates must be less than maximum coordinates");
  }
  return [minLng, minLat, maxLng, maxLat];
}

function canonicalHttpsSpelling(value: string): boolean {
  return value.startsWith("https://") && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function tileAuthority(value: string): string | null {
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/u.exec(value);
  return match?.[1] ?? null;
}

function boundedHost(host: string): string {
  return host.length <= 120 ? host : `${host.slice(0, 117)}...`;
}

function parseTileUrl(value: unknown): string | ParseFailure {
  if (!nonBlankString(value)) {
    return fail("tiles.urlTemplate", "must be a non-blank HTTPS URL template");
  }
  const authority = tileAuthority(value);
  if (!canonicalHttpsSpelling(value) || authority === null || authority.includes(":")) {
    return fail(
      "tiles.urlTemplate",
      "must use canonical lowercase HTTPS without whitespace, credentials, or an explicit port",
    );
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
      return fail("tiles.urlTemplate", "must use HTTPS without credentials or an explicit port");
    }
    if (!allowedHosts.has(url.hostname)) {
      return fail("tiles.urlTemplate", `host ${boundedHost(url.hostname)} is not allowlisted`);
    }
    if (/[?#]/u.test(value)) {
      return fail("tiles.urlTemplate", "must not contain a query string or fragment");
    }
    if (!["{z}", "{x}", "{y}"].every((token) => value.includes(token))) {
      return fail("tiles.urlTemplate", "must contain {z}, {x}, and {y}");
    }
    return value;
  } catch {
    return fail("tiles.urlTemplate", "must be a valid HTTPS URL template");
  }
}

function parseEntry(value: unknown, currentYear: number): ParseResult {
  if (!isRecord(value)) return fail("entry", "must be an object");
  if (!nonBlankString(value.id) || !ID_PATTERN.test(value.id)) {
    return fail("id", "must match ^[a-z0-9-]{1,64}$");
  }
  if (typeof value.type !== "string" || !TILE_TYPES.has(value.type as LayerType)) {
    return fail("type", "must be raster-era or vector-dated");
  }
  if (!nonBlankString(value.provider)) return fail("provider", "must be non-blank");

  const title = value.title;
  if (!isRecord(title) || !nonBlankString(title.ja) || !nonBlankString(title.en)) {
    return fail("title", "must contain non-blank ja and en strings");
  }

  const era = value.era;
  if (
    !isRecord(era) ||
    !Number.isInteger(era.from) ||
    !(era.to === null || Number.isInteger(era.to))
  ) {
    return fail("era", "from must be an integer and to must be an integer or null");
  }
  const eraTo = era.to === null ? currentYear : (era.to as number);
  if ((era.from as number) > eraTo) return fail("era", "from must be less than or equal to to");

  if (typeof value.region !== "string" || !REGION_PATTERN.test(value.region)) {
    return fail("region", "must be GLOBAL or an uppercase ISO alpha-2 code");
  }
  if (!Array.isArray(value.coverage) || value.coverage.length === 0) {
    return fail("coverage", "must contain at least one bounding box");
  }
  const coverage: Bbox[] = [];
  for (const [bboxIndex, rawBbox] of value.coverage.entries()) {
    const bbox = parseBbox(rawBbox, `coverage[${bboxIndex}]`);
    if ("reason" in bbox) return bbox;
    coverage.push(bbox);
  }

  const tiles = value.tiles;
  if (!isRecord(tiles)) return fail("tiles", "must be an object");
  const urlTemplate = parseTileUrl(tiles.urlTemplate);
  if (typeof urlTemplate !== "string") return urlTemplate;
  if (typeof tiles.scheme !== "string" || !TILE_SCHEMES.has(tiles.scheme as TileScheme)) {
    return fail("tiles.scheme", "must be xyz or tms");
  }
  if (
    !Number.isInteger(tiles.minzoom) ||
    !Number.isInteger(tiles.maxzoom) ||
    (tiles.minzoom as number) < 0 ||
    (tiles.maxzoom as number) > 22 ||
    (tiles.minzoom as number) > (tiles.maxzoom as number)
  ) {
    return fail("tiles.zoom", "minzoom and maxzoom must be ordered integers in 0..22");
  }
  if (tiles.tileSize !== 256 && tiles.tileSize !== 512) {
    return fail("tiles.tileSize", "must be 256 or 512");
  }

  const attribution = value.attribution;
  if (!isRecord(attribution) || !nonBlankString(attribution.text)) {
    return fail("attribution.text", "must be non-blank");
  }
  const attributionUrl = optionalHttpsUrl(attribution.url, "attribution.url");
  if (isFailure(attributionUrl)) return attributionUrl;
  const license = attribution.license;
  if (!isRecord(license) || !nonBlankString(license.name)) {
    return fail("attribution.license.name", "must be non-blank");
  }
  const licenseUrl = optionalHttpsUrl(license.url, "attribution.license.url");
  if (isFailure(licenseUrl)) return licenseUrl;

  const flags = value.flags;
  if (
    !isRecord(flags) ||
    typeof flags.experimental !== "boolean" ||
    !(flags.requiresFeatureFlag === null || nonBlankString(flags.requiresFeatureFlag))
  ) {
    return fail("flags", "must contain experimental boolean and non-blank feature flag or null");
  }
  if (
    new URL(urlTemplate).hostname === KONJAKU_HOST &&
    flags.requiresFeatureFlag !== KONJAKU_FEATURE_FLAG
  ) {
    return fail(
      "flags.requiresFeatureFlag",
      `${KONJAKU_HOST} tiles must require ${KONJAKU_FEATURE_FLAG}`,
    );
  }
  if (!Number.isInteger(value.priority)) return fail("priority", "must be an integer");

  return {
    entry: {
      id: value.id,
      type: value.type as LayerType,
      provider: value.provider,
      title: { ja: title.ja, en: title.en },
      era: { from: era.from as number, to: eraTo },
      region: value.region,
      coverage,
      tiles: {
        urlTemplate,
        scheme: tiles.scheme as TileScheme,
        minzoom: tiles.minzoom as number,
        maxzoom: tiles.maxzoom as number,
        tileSize: tiles.tileSize,
      },
      attribution: {
        text: attribution.text,
        ...(typeof attributionUrl === "string" ? { url: attributionUrl } : {}),
        license: {
          name: license.name,
          ...(typeof licenseUrl === "string" ? { url: licenseUrl } : {}),
        },
      },
      flags: {
        experimental: flags.experimental,
        requiresFeatureFlag: flags.requiresFeatureFlag,
      },
      priority: value.priority as number,
    },
  };
}

function defaultWarn(warning: RegistryWarning): void {
  console.warn(
    `Layer registry entry ${warning.index} dropped: ${warning.field}: ${warning.reason}`,
  );
}

export function loadRegistry(json: readonly unknown[], env: RegistryEnv): LayerEntry[] {
  const warn = env.warn ?? defaultWarn;
  if (!Number.isInteger(env.currentYear)) {
    warn({ index: -1, field: "env.currentYear", reason: "must be an integer" });
    return [];
  }

  const entries: LayerEntry[] = [];
  const seenIds = new Set<string>();
  for (const [index, value] of json.entries()) {
    const parsed = parseEntry(value, env.currentYear);
    if (!("entry" in parsed)) {
      warn({ index, field: parsed.field, reason: parsed.reason });
      continue;
    }
    if (seenIds.has(parsed.entry.id)) {
      warn({ index, field: "id", reason: `duplicate id ${parsed.entry.id}` });
      continue;
    }
    seenIds.add(parsed.entry.id);
    const requiredFlag = parsed.entry.flags.requiresFeatureFlag;
    if (requiredFlag !== null && env.featureFlags[requiredFlag] !== "true") {
      continue;
    }
    entries.push(parsed.entry);
  }
  return entries;
}

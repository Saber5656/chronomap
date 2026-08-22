import { expect, type Page, type Route } from "@playwright/test";

import commonsFixture from "./commons.json" with { type: "json" };
import geosearchFixture from "./geosearch.json" with { type: "json" };
import summaryFixture from "./summary.json" with { type: "json" };

const TILE_FIXTURE_PATH = new URL("./tile.png", import.meta.url).pathname;
const THUMBNAIL_FIXTURE_PATH = new URL("./thumbnail.png", import.meta.url).pathname;
const TILE_HOSTS = new Set(["cyberjapandata.gsi.go.jp", "ktgis.net"]);
const UPLOAD_HOST = "upload.wikimedia.org";
const COMMONS_HOST = "commons.wikimedia.org";
const ONBOARDING_STORAGE_KEY = "chronomap.onboarded";
const ONBOARDING_COMPLETE_VALUE = "1";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

export type MissingTile =
  | string
  | Readonly<{
      layerId: string;
      zoom?: number | readonly number[];
    }>;

export interface StubUpstreamOptions {
  readonly missing?: readonly MissingTile[];
  /** Let browser-level security tests observe the request before the harness blocks it. */
  readonly passthroughHosts?: readonly string[];
  /** Allow the dedicated onboarding spec to exercise the first-visit coach. */
  readonly onboarding?: "first-visit";
}

interface RequestRecorder {
  readonly unstubbedRequests: string[];
}

const recorders = new WeakMap<Page, RequestRecorder>();

function isWikipediaHost(hostname: string): boolean {
  return hostname === "wikipedia.org" || hostname.endsWith(".wikipedia.org");
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isSameOriginOrLocalRequest(page: Page, url: URL): boolean {
  if (url.protocol === "about:" || url.protocol === "blob:" || url.protocol === "data:") {
    return true;
  }

  const currentPageUrl = page.url();
  if (currentPageUrl !== "about:blank") {
    try {
      return new URL(currentPageUrl).origin === url.origin;
    } catch {
      return false;
    }
  }

  return isLoopbackHost(url.hostname);
}

function normalizedLayer(value: string): string {
  return value
    .toLowerCase()
    .replace(/^gsi[-_]/u, "")
    .replace(/[^a-z0-9]/gu, "");
}

function tileLayerMatches(url: URL, layerId: string): boolean {
  const normalizedPath = normalizedLayer(decodeURIComponent(url.pathname));
  const normalizedId = normalizedLayer(layerId);
  return normalizedId.length > 0 && normalizedPath.includes(normalizedId);
}

function tileZoom(url: URL): number | null {
  const pathSegments = url.pathname.split("/");
  const zoomSegment = pathSegments.at(-3);
  if (zoomSegment === undefined || !/^\d+$/u.test(zoomSegment)) return null;

  const zoom = Number(zoomSegment);
  return Number.isSafeInteger(zoom) ? zoom : null;
}

function missingTileMatches(url: URL, missing: readonly MissingTile[]): boolean {
  const zoom = tileZoom(url);

  return missing.some((entry) => {
    const layerId = typeof entry === "string" ? entry : entry.layerId;
    if (!tileLayerMatches(url, layerId)) return false;

    if (typeof entry === "string" || entry.zoom === undefined) return true;
    const configuredZooms = Array.isArray(entry.zoom) ? entry.zoom : [entry.zoom];
    return zoom !== null && configuredZooms.includes(zoom);
  });
}

function jsonResponseBody(value: unknown): string {
  return JSON.stringify(value);
}

async function fulfillJson(route: Route, value: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: CORS_HEADERS,
    body: jsonResponseBody(value),
  });
}

async function handleRequest(
  page: Page,
  route: Route,
  options: StubUpstreamOptions,
  recorder: RequestRecorder,
): Promise<void> {
  const requestUrl = route.request().url();
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    recorder.unstubbedRequests.push(requestUrl);
    await route.abort("blockedbyclient");
    return;
  }

  if (isSameOriginOrLocalRequest(page, url)) {
    await route.continue();
    return;
  }

  if (options.passthroughHosts?.includes(url.hostname) === true) {
    await route.continue();
    return;
  }

  if (TILE_HOSTS.has(url.hostname)) {
    if (missingTileMatches(url, options.missing ?? [])) {
      await route.fulfill({
        status: 404,
        contentType: "text/plain; charset=utf-8",
        headers: CORS_HEADERS,
        body: "missing tile",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: CORS_HEADERS,
      path: TILE_FIXTURE_PATH,
    });
    return;
  }

  if (
    isWikipediaHost(url.hostname) &&
    (url.pathname === "/w/api.php" || url.pathname.startsWith("/api/rest_v1/page/summary/"))
  ) {
    if (url.pathname === "/w/api.php") {
      await fulfillJson(route, geosearchFixture);
    } else {
      await fulfillJson(route, summaryFixture);
    }
    return;
  }

  if (url.hostname === UPLOAD_HOST) {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: CORS_HEADERS,
      path: THUMBNAIL_FIXTURE_PATH,
    });
    return;
  }

  if (url.hostname === COMMONS_HOST) {
    await fulfillJson(route, commonsFixture);
    return;
  }

  recorder.unstubbedRequests.push(url.href);
  await route.abort("blockedbyclient");
}

/** Register deterministic provider responses and block every other external request. */
export async function stubUpstream(page: Page, options: StubUpstreamOptions = {}): Promise<void> {
  if (options.onboarding !== "first-visit") {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: ONBOARDING_STORAGE_KEY,
      value: ONBOARDING_COMPLETE_VALUE,
    });
  }
  const recorder: RequestRecorder = { unstubbedRequests: [] };
  recorders.set(page, recorder);
  await page.route("**/*", (route) => handleRequest(page, route, options, recorder));
}

/** Fail with every URL that was blocked instead of being fulfilled by this harness. */
export function assertNoUnstubbedRequests(page: Page): void {
  const recorder = recorders.get(page);
  if (recorder === undefined) {
    throw new Error("stubUpstream(page) must be called before assertNoUnstubbedRequests(page).");
  }

  expect(
    recorder.unstubbedRequests,
    "Unexpected cross-origin requests were blocked by the e2e network harness.",
  ).toEqual([]);
}

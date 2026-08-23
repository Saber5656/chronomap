import { isShareRoute } from "../app/routes";
import { parseSharedLocation, type ParseResult } from "./parseSharedLocation";

export const SHARE_PREFILL_LENGTH = 500;
const DEFAULT_SHARE_ZOOM = 16;

type SuccessfulParse = Extract<ParseResult, { ok: true }>;
type FailedParse = Extract<ParseResult, { ok: false }>;

export interface ShareInputSelection {
  readonly primary: string;
  readonly candidates: readonly string[];
}

export interface ShareFallback {
  readonly prefill: string;
  readonly reason: FailedParse["reason"];
}

export interface ShareRouteOptions {
  readonly basePath: string;
  readonly location?: Pick<Location, "href" | "origin" | "replace">;
  readonly history?: Pick<History, "replaceState">;
  readonly parseLocation?: (raw: string) => ParseResult;
}

export type ShareRouteOutcome =
  | { readonly kind: "not-share" }
  | { readonly kind: "redirect"; readonly parsed: SuccessfulParse; readonly target: string }
  | { readonly kind: "fallback"; readonly fallback: ShareFallback };

function nonEmpty(value: string | null): string | null {
  if (value === null || value.trim().length === 0) return null;
  return value;
}

/** Select Android's varying share fields while keeping the original primary value intact. */
export function selectShareInput(params: Pick<URLSearchParams, "get">): ShareInputSelection {
  const url = nonEmpty(params.get("url"));
  const text = nonEmpty(params.get("text"));
  const title = nonEmpty(params.get("title"));
  const primary = url ?? text ?? title ?? "";
  const candidates: string[] = [primary];

  if (url !== null && text !== null) {
    const concatenated = `${text} ${url}`.trim();
    if (concatenated !== primary) candidates.push(concatenated);
  }

  return { primary, candidates };
}

function truncateForDisplay(value: string): string {
  return [...value].slice(0, SHARE_PREFILL_LENGTH).join("");
}

function safeParse(parseLocation: (raw: string) => ParseResult, raw: string): ParseResult {
  try {
    return parseLocation(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

function resolveBaseUrl(
  pageLocation: Pick<Location, "href" | "origin">,
  basePath: string,
): URL | null {
  try {
    const currentUrl = new URL(pageLocation.href);
    const baseUrl = new URL(basePath, currentUrl.href);
    if (baseUrl.origin !== pageLocation.origin || baseUrl.origin !== currentUrl.origin) return null;
    baseUrl.search = "";
    baseUrl.hash = "";
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname = `${baseUrl.pathname}/`;
    return baseUrl;
  } catch {
    return null;
  }
}

function buildRedirectUrl(baseUrl: URL, parsed: SuccessfulParse): string {
  const target = new URL(baseUrl.href);
  const params = new URLSearchParams();
  params.set("lat", String(parsed.lat));
  params.set("lng", String(parsed.lng));
  params.set("z", String(parsed.zoom ?? DEFAULT_SHARE_ZOOM));
  if (parsed.label !== undefined) params.set("label", parsed.label);
  target.search = params.toString();
  target.hash = "";
  return target.href;
}

function cleanAddressBar(history: Pick<History, "replaceState"> | undefined, baseUrl: URL): void {
  history?.replaceState(null, "", baseUrl.href);
}

/** Handle the URL-level Web Share Target contract before the app shell mounts. */
export function handleShareRoute(options: ShareRouteOptions): ShareRouteOutcome {
  const pageLocation = options.location ?? globalThis.location;
  const pageHistory = options.history ?? globalThis.history;
  const currentUrl = new URL(pageLocation.href);
  const baseUrl = resolveBaseUrl(pageLocation, options.basePath);

  if (baseUrl === null || !isShareRoute(currentUrl.pathname, baseUrl.pathname)) {
    return { kind: "not-share" };
  }

  const selection = selectShareInput(currentUrl.searchParams);
  const parseLocation = options.parseLocation ?? parseSharedLocation;
  let parsed: ParseResult = { ok: false, reason: "no-coords" };

  for (const candidate of selection.candidates) {
    parsed = safeParse(parseLocation, candidate);
    if (parsed.ok) break;
  }

  if (parsed.ok) {
    const target = buildRedirectUrl(baseUrl, parsed);
    cleanAddressBar(pageHistory, baseUrl);
    pageLocation.replace(target);
    return { kind: "redirect", parsed, target };
  }

  cleanAddressBar(pageHistory, baseUrl);
  return {
    kind: "fallback",
    fallback: { prefill: truncateForDisplay(selection.primary), reason: parsed.reason },
  };
}

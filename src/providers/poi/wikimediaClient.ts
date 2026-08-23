import { WIKIMEDIA_API_HOSTS } from "../../security/hosts";
import { createLru } from "../../util/lru";
import type { PoiProviderError } from "./types";

export const WIKIMEDIA_TIMEOUT_MS = 8_000;
export const WIKIMEDIA_MAX_RESPONSE_BYTES = 512 * 1024;
export const WIKIMEDIA_CACHE_CAPACITY = 200;

export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface WikimediaFetchOptions {
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
  allowedApiHosts?: ReadonlySet<string>;
}

type UnknownRecord = Record<string, unknown>;

interface CachedResponse {
  readonly promise: Promise<unknown>;
  signal: AbortSignal | undefined;
}

const responseCache = createLru<string, CachedResponse>(WIKIMEDIA_CACHE_CAPACITY);

class PoiProviderException extends Error implements PoiProviderError {
  readonly kind: PoiProviderError["kind"];
  declare readonly status?: number;

  constructor(error: PoiProviderError) {
    super(error.kind);
    this.name = "PoiProviderError";
    this.kind = error.kind;
    if (error.status !== undefined) this.status = error.status;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isPoiProviderError(value: unknown): value is PoiProviderException {
  return value instanceof PoiProviderException;
}

function errorName(value: unknown): string | null {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  return value.name;
}

function isTimeoutReason(value: unknown): boolean {
  return errorName(value) === "TimeoutError";
}

function isAbortReason(value: unknown): boolean {
  return errorName(value) === "AbortError";
}

function providerError(error: PoiProviderError): PoiProviderException {
  return new PoiProviderException(error);
}

function malformedError(): PoiProviderException {
  return providerError({ kind: "malformed" });
}

function assertWikimediaUrl(url: URL, allowedApiHosts = WIKIMEDIA_API_HOSTS): void {
  if (
    url.protocol !== "https:" ||
    !allowedApiHosts.has(url.host) ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error("Wikimedia URL must use HTTPS and an allowlisted host without credentials.");
  }
}

interface CombinedSignal {
  signal: AbortSignal;
  cleanup(): void;
}

function combinedSignal(callerSignal: AbortSignal | undefined): CombinedSignal {
  const timeoutSignal = AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS);
  const fallbackTimeoutController = new AbortController();
  const fallbackTimer = setTimeout(() => {
    fallbackTimeoutController.abort(new DOMException("The request timed out.", "TimeoutError"));
  }, WIKIMEDIA_TIMEOUT_MS);
  const signals =
    callerSignal === undefined
      ? [timeoutSignal, fallbackTimeoutController.signal]
      : [callerSignal, timeoutSignal, fallbackTimeoutController.signal];

  return {
    signal: AbortSignal.any(signals),
    cleanup() {
      clearTimeout(fallbackTimer);
    },
  };
}

function normalizeError(
  error: unknown,
  signal: AbortSignal,
  callerSignal: AbortSignal | undefined,
): PoiProviderException {
  if (callerSignal?.aborted) return providerError({ kind: "aborted" });
  if (signal.aborted) {
    return isTimeoutReason(signal.reason)
      ? providerError({ kind: "timeout" })
      : providerError({ kind: "aborted" });
  }
  if (isTimeoutReason(error)) return providerError({ kind: "timeout" });
  if (isAbortReason(error)) return providerError({ kind: "aborted" });
  return providerError({ kind: "network" });
}

function responseHasJsonContentType(response: Response): boolean {
  const contentType = response.headers.get("content-type");
  return contentType?.toLowerCase().includes("application/json") ?? false;
}

function readJson(response: Response): Promise<unknown> {
  return response.text().then((body) => {
    const bodyBytes = typeof body === "string" ? new TextEncoder().encode(body).byteLength : 0;
    if (
      typeof body !== "string" ||
      body.length > WIKIMEDIA_MAX_RESPONSE_BYTES ||
      bodyBytes > WIKIMEDIA_MAX_RESPONSE_BYTES
    ) {
      throw malformedError();
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw malformedError();
    }
  });
}

/** Fetch one allowlisted Wikimedia API URL and return the parsed, still-unvalidated JSON value. */
export function wikimediaFetch(url: URL, opts: WikimediaFetchOptions = {}): Promise<unknown> {
  assertWikimediaUrl(url, opts.allowedApiHosts);
  const requestUrl = new URL(url.href);
  const combined = combinedSignal(opts.signal);
  const { signal } = combined;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const init: RequestInit = {
    headers: {
      "Api-User-Agent": `chronomap/${__APP_VERSION__} (+https://github.com/Saber5656/chronomap)`,
    },
    signal,
  };

  try {
    return Promise.resolve(fetchImpl(requestUrl, init))
      .then((response) => {
        if (!response.ok) {
          throw providerError({ kind: "http", status: response.status });
        }
        if (!responseHasJsonContentType(response)) throw malformedError();
        return readJson(response);
      })
      .then((value) => value)
      .catch((error: unknown) => {
        if (isPoiProviderError(error)) throw error;
        throw normalizeError(error, signal, opts.signal);
      })
      .finally(() => combined.cleanup());
  } catch (error: unknown) {
    combined.cleanup();
    return Promise.reject(normalizeError(error, signal, opts.signal));
  }
}

/** Fetch and cache one parsed Wikimedia response for the lifetime of this module instance. */
export function cachedFetch(
  key: string,
  url: URL,
  opts: WikimediaFetchOptions = {},
): Promise<unknown> {
  assertWikimediaUrl(url, opts.allowedApiHosts);
  const cached = responseCache.get(key);
  if (cached !== undefined && !cached.signal?.aborted) return cached.promise;
  if (cached !== undefined) responseCache.delete(key);

  const request = wikimediaFetch(url, opts);
  responseCache.set(key, { promise: request, signal: opts.signal });
  void request.then(
    () => {
      const current = responseCache.get(key);
      if (current?.promise === request) current.signal = undefined;
    },
    () => {
      const current = responseCache.get(key);
      if (current?.promise === request) responseCache.delete(key);
    },
  );
  return request;
}

/** Clear the session cache; exposed for deterministic consumers and unit tests. */
export function clearWikimediaCache(): void {
  responseCache.clear();
}

export interface LatestOnlyRunner {
  <Result, Args extends unknown[]>(
    operation: (signal: AbortSignal, ...args: Args) => Promise<Result>,
    ...args: Args
  ): Promise<Result>;
}

function createLatestOnlyRunner(): LatestOnlyRunner {
  let active: AbortController | null = null;

  return <Result, Args extends unknown[]>(
    operation: (signal: AbortSignal, ...args: Args) => Promise<Result>,
    ...args: Args
  ): Promise<Result> => {
    active?.abort();
    const controller = new AbortController();
    active = controller;

    let operationPromise: Promise<Result>;
    try {
      operationPromise = Promise.resolve(operation(controller.signal, ...args));
    } catch (error: unknown) {
      operationPromise = Promise.reject(
        error instanceof Error ? error : new Error("latestOnly operation failed."),
      );
    }
    return operationPromise.finally(() => {
      if (active === controller) active = null;
    });
  };
}

export function latestOnly(): LatestOnlyRunner;
export function latestOnly<Result, Args extends unknown[]>(
  operation: (signal: AbortSignal, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result>;
export function latestOnly<Result, Args extends unknown[]>(
  operation?: (signal: AbortSignal, ...args: Args) => Promise<Result>,
): LatestOnlyRunner | ((...args: Args) => Promise<Result>) {
  const runner = createLatestOnlyRunner();
  if (operation === undefined) return runner;
  return (...args: Args) => runner(operation, ...args);
}

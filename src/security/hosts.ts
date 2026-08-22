/** Exact third-party hosts used by Wikimedia API, image, and tile requests. */
export const WIKIMEDIA_API_HOSTS: ReadonlySet<string> = new Set([
  "ja.wikipedia.org",
  "en.wikipedia.org",
  "commons.wikimedia.org",
]);

export const WIKIMEDIA_IMG_HOSTS: ReadonlySet<string> = new Set(["upload.wikimedia.org"]);

export const KONJAKU_HOST = "ktgis.net";
export const KONJAKU_FEATURE_FLAG = "VITE_ENABLE_KONJAKU";

export const TILE_HOSTS: ReadonlySet<string> = new Set(["cyberjapandata.gsi.go.jp", KONJAKU_HOST]);

/** Registry and document-policy gates use the same exact-string build flag contract. */
export function isFeatureFlagEnabled(
  featureFlags: Readonly<Record<string, unknown>>,
  flag: string,
): boolean {
  return featureFlags[flag] === "true";
}

export function isKonjakuEnabled(featureFlags: Readonly<Record<string, unknown>>): boolean {
  return isFeatureFlagEnabled(featureFlags, KONJAKU_FEATURE_FLAG);
}

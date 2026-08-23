import {
  COMMONS_PHOTOS_FEATURE_FLAG,
  isKonjakuEnabled,
  KONJAKU_HOST,
  TILE_HOSTS,
  WIKIMEDIA_API_HOSTS,
  WIKIMEDIA_IMG_HOSTS,
} from "./hosts";

export interface ContentSecurityPolicyOptions {
  readonly enableKonjaku?: boolean;
  readonly enableCommonsPhotos?: boolean;
  readonly featureFlags?: Readonly<Record<string, unknown>>;
}

function origins(hosts: readonly string[]): string {
  return hosts.map((host) => `https://${host}`).join(" ");
}

/**
 * Return the image origins permitted by the final v1 policy in stable source order.
 * Konjaku is appended only for the build that enables its registry feature flag.
 */
export function cspImageHosts(options: ContentSecurityPolicyOptions = {}): readonly string[] {
  const enableKonjaku =
    options.enableKonjaku ??
    (options.featureFlags === undefined ? false : isKonjakuEnabled(options.featureFlags));
  const hosts = [...TILE_HOSTS].filter((host) => host !== KONJAKU_HOST);
  hosts.push(...WIKIMEDIA_IMG_HOSTS);
  if (enableKonjaku) hosts.push(KONJAKU_HOST);
  return hosts;
}

/** Return tile and API origins used by fetch/XHR requests under connect-src. */
export function cspConnectHosts(options: ContentSecurityPolicyOptions = {}): readonly string[] {
  const enableKonjaku =
    options.enableKonjaku ??
    (options.featureFlags === undefined ? false : isKonjakuEnabled(options.featureFlags));
  const tileHosts = [...TILE_HOSTS].filter((host) => host !== KONJAKU_HOST);
  if (enableKonjaku) tileHosts.push(KONJAKU_HOST);
  const hosts = [...tileHosts, ...WIKIMEDIA_API_HOSTS];
  const enableCommonsPhotos =
    options.enableCommonsPhotos ?? options.featureFlags?.[COMMONS_PHOTOS_FEATURE_FLAG] === "true";
  if (enableCommonsPhotos) hosts.push("commons.wikimedia.org");
  return hosts;
}

/** Build the exact meta-CSP from the auditable provider host inventory. */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: blob: ${origins(cspImageHosts(options))}`,
    `connect-src 'self' ${origins(cspConnectHosts(options))}`,
    "worker-src 'self' blob:",
    "child-src blob:",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
}

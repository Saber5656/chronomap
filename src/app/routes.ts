/** Normalize a route path without allowing a trailing slash to change its identity. */
export function normalizeRoutePath(pathname: string): string {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/u, "");
  return withoutTrailingSlash === "" ? "/" : withoutTrailingSlash;
}

/** Convert Vite's base setting into the path prefix used by the browser router. */
export function normalizeBasePath(basePath: string): string {
  const candidate = basePath.trim();
  if (candidate === "" || candidate === "." || candidate === "./") return "/";

  try {
    if (/^[a-z][a-z\d+.-]*:/iu.test(candidate)) {
      return normalizeRoutePath(new URL(candidate).pathname);
    }
  } catch {
    return "/";
  }

  return normalizeRoutePath(candidate);
}

/** Detect the canonical `/share` route under the configured application base. */
export function isShareRoute(pathname: string, basePath: string): boolean {
  const base = normalizeBasePath(basePath);
  const sharePath = base === "/" ? "/share" : `${base}/share`;
  return normalizeRoutePath(pathname) === sharePath;
}

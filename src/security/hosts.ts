/** Exact third-party hosts used by Wikimedia API, image, and tile requests. */
export const WIKIMEDIA_API_HOSTS: ReadonlySet<string> = new Set([
  "ja.wikipedia.org",
  "en.wikipedia.org",
  "commons.wikimedia.org",
]);

export const WIKIMEDIA_IMG_HOSTS: ReadonlySet<string> = new Set(["upload.wikimedia.org"]);

export const TILE_HOSTS: ReadonlySet<string> = new Set(["cyberjapandata.gsi.go.jp", "ktgis.net"]);

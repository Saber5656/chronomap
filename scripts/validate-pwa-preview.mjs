import { setTimeout as delay } from "node:timers/promises";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4173/chronomap/");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchReady(url) {
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${url}: preview server did not become ready (${lastError?.message})`);
}

const pageResponse = await fetchReady(baseUrl);
assert(
  pageResponse.headers.get("content-type")?.startsWith("text/html"),
  `preview page content type mismatch: ${pageResponse.headers.get("content-type")}`,
);
const page = await pageResponse.text();
const manifestUrl = new URL("manifest.webmanifest", baseUrl);
const manifestLink = page.match(/<link\s+rel="manifest"\s+href="([^"]+)"/);
assert(manifestLink, "preview page is missing the manifest link");
assert(
  new URL(manifestLink[1], baseUrl).href === manifestUrl.href,
  `preview manifest link escaped the base: ${manifestLink[1]}`,
);

const manifestResponse = await fetchReady(manifestUrl);
assert(
  manifestResponse.headers.get("content-type")?.startsWith("application/manifest+json"),
  `preview manifest content type mismatch: ${manifestResponse.headers.get("content-type")}`,
);
const manifest = await manifestResponse.json();
assert(manifest.name === "chronomap — 時間旅行地図", "preview manifest.name mismatch");
assert(
  Array.isArray(manifest.icons) && manifest.icons.length === 3,
  "preview manifest icons mismatch",
);

for (const icon of manifest.icons) {
  const iconUrl = new URL(icon.src, manifestUrl);
  const iconResponse = await fetchReady(iconUrl);
  assert(
    iconResponse.headers.get("content-type")?.startsWith("image/png"),
    `${iconUrl} content type mismatch: ${iconResponse.headers.get("content-type")}`,
  );
  const bytes = new Uint8Array(await iconResponse.arrayBuffer());
  assert(
    bytes.length >= 8 &&
      bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]),
    `${iconUrl} is not a PNG response`,
  );
}

console.log(
  `PWA preview smoke passed: ${baseUrl.href}, manifest ${manifestResponse.status}, ${manifest.icons.length} PNG icons fetched.`,
);

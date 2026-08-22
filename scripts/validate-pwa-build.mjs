import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { resolve } from "node:path";

const distRoot = resolve("dist");
const manifestUrl = new URL("https://chronomap.example/chronomap/manifest.webmanifest");
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readBuffer(relativePath) {
  return readFile(resolve(distRoot, relativePath));
}

async function readText(relativePath) {
  return readBuffer(relativePath).then((contents) => contents.toString("utf8"));
}

function parsePng(contents, relativePath) {
  assert(contents.subarray(0, 8).equals(pngSignature), `${relativePath} is not a PNG`);

  let offset = 8;
  let header;
  let hasSrgb = false;
  const idatChunks = [];
  let hasIend = false;

  while (offset < contents.length) {
    assert(offset + 12 <= contents.length, `${relativePath} has a truncated PNG chunk`);
    const length = contents.readUInt32BE(offset);
    const type = contents.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    assert(chunkEnd <= contents.length, `${relativePath} has an out-of-bounds PNG chunk`);
    const data = contents.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      assert(!header, `${relativePath} has multiple IHDR chunks`);
      assert(length === 13, `${relativePath} has an invalid IHDR`);
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compressionMethod: data[10],
        filterMethod: data[11],
        interlaceMethod: data[12],
      };
    } else if (type === "sRGB") {
      hasSrgb = true;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      hasIend = true;
      break;
    }
    offset = chunkEnd;
  }

  assert(header && hasIend, `${relativePath} is missing required PNG chunks`);
  assert(idatChunks.length > 0, `${relativePath} is missing image data`);
  assert(header.width > 0 && header.height > 0, `${relativePath} has invalid dimensions`);
  assert(header.bitDepth === 8, `${relativePath} must use 8-bit channels`);
  assert(header.colorType === 6, `${relativePath} must use RGBA color`);
  assert(header.compressionMethod === 0, `${relativePath} has an invalid compression method`);
  assert(header.filterMethod === 0, `${relativePath} has an invalid filter method`);
  assert(header.interlaceMethod === 0, `${relativePath} must not be interlaced`);
  assert(hasSrgb, `${relativePath} is missing the sRGB metadata chunk`);

  return { ...header, idatChunks };
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgba(png, relativePath) {
  const bytesPerPixel = 4;
  const rowLength = png.width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(png.idatChunks));
  const expectedLength = png.height * (rowLength + 1);
  assert(raw.length === expectedLength, `${relativePath} has an invalid scanline length`);

  const pixels = Buffer.alloc(png.height * rowLength);
  let rawOffset = 0;
  for (let y = 0; y < png.height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    assert(filter <= 4, `${relativePath} uses an unsupported PNG filter`);

    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? pixels[y * rowLength + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[(y - 1) * rowLength + x] : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * rowLength + x - bytesPerPixel] : 0;
      let value = raw[rawOffset];
      rawOffset += 1;
      if (filter === 1) value += left;
      if (filter === 2) value += above;
      if (filter === 3) value += Math.floor((left + above) / 2);
      if (filter === 4) value += paethPredictor(left, above, upperLeft);
      pixels[y * rowLength + x] = value & 0xff;
    }
  }
  return pixels;
}

function assertOpaque(pixels, relativePath) {
  for (let pixelOffset = 3; pixelOffset < pixels.length; pixelOffset += 4) {
    assert(
      pixels[pixelOffset] === 255,
      `${relativePath} must have an opaque full-canvas background`,
    );
  }
}

function assertMaskableSafeZone(png, pixels, relativePath) {
  const minSafeCoordinate = Math.ceil(png.width * 0.1);
  const maxSafeCoordinate = Math.floor(png.width * 0.9);
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const pixelOffset = (y * png.width + x) * 4;
      const alpha = pixels[pixelOffset + 3];
      const isForeground =
        alpha > 0 &&
        (pixels[pixelOffset] < 245 ||
          pixels[pixelOffset + 1] < 245 ||
          pixels[pixelOffset + 2] < 245);
      if (!isForeground) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert(maxX >= 0, `${relativePath} has no visible foreground`);
  assert(
    minX >= minSafeCoordinate &&
      minY >= minSafeCoordinate &&
      maxX <= maxSafeCoordinate &&
      maxY <= maxSafeCoordinate,
    `${relativePath} foreground (${minX},${minY})-(${maxX},${maxY}) escapes the inner 80% safe zone`,
  );
  return `${minX},${minY}-${maxX},${maxY}`;
}

const manifest = JSON.parse(await readText("manifest.webmanifest"));
assert(manifest.name === "chronomap — 時間旅行地図", "manifest.name mismatch");
assert(manifest.short_name === "chronomap", "manifest.short_name mismatch");
assert(manifest.lang === "ja", "manifest.lang mismatch");
assert(manifest.display === "standalone", "manifest.display mismatch");
assert(manifest.orientation === "any", "manifest.orientation mismatch");
assert(manifest.start_url === ".", "manifest.start_url must stay base-relative");
assert(manifest.scope === ".", "manifest.scope must stay base-relative");
assert(manifest.theme_color === "#2d6cdf", "manifest.theme_color mismatch");
assert(manifest.background_color === "#f5f7fa", "manifest.background_color mismatch");

const expectedIcons = [
  ["icons/pwa-192.png", "192x192", undefined],
  ["icons/pwa-512.png", "512x512", undefined],
  ["icons/pwa-maskable-512.png", "512x512", "maskable"],
];
assert(Array.isArray(manifest.icons), "manifest.icons must be an array");
assert(manifest.icons.length === expectedIcons.length, "manifest icon count mismatch");
for (const [index, [src, sizes, purpose]] of expectedIcons.entries()) {
  const icon = manifest.icons[index];
  assert(icon.src === src, `manifest.icons[${index}].src mismatch`);
  assert(icon.sizes === sizes, `manifest.icons[${index}].sizes mismatch`);
  assert(icon.type === "image/png", `manifest.icons[${index}].type mismatch`);
  assert(icon.purpose === purpose, `manifest.icons[${index}].purpose mismatch`);
  assert(new URL(icon.src, manifestUrl).pathname === `/chronomap/${src}`, `${src} escaped base`);
}
assert(
  new URL(manifest.start_url, manifestUrl).pathname === "/chronomap/",
  "start_url escaped base",
);
assert(new URL(manifest.scope, manifestUrl).pathname === "/chronomap/", "scope escaped base");

const index = await readText("index.html");
assert(index.includes('<html lang="ja">'), "HTML language metadata missing");
assert(
  index.includes('<link rel="manifest" href="/chronomap/manifest.webmanifest">'),
  "manifest link missing",
);
assert(
  index.includes(
    '<link rel="apple-touch-icon" sizes="180x180" href="/chronomap/icons/pwa-180.png" />',
  ),
  "apple icon link missing",
);
assert(index.includes('<meta name="theme-color" content="#2d6cdf" />'), "theme-color meta missing");
assert(
  index.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'),
  "iOS standalone meta missing",
);
assert(
  index.includes('<meta name="apple-mobile-web-app-status-bar-style" content="default" />'),
  "iOS status-bar metadata missing",
);
assert(
  index.includes('<meta name="apple-mobile-web-app-title" content="chronomap" />'),
  "iOS app-title metadata missing",
);
assert(
  !/(?:registerSW|navigator\.serviceWorker\.register|virtual:pwa-register)/.test(index),
  "runtime SW registration was injected",
);

const svg = await readText("icons/icon.svg");
assert(/<svg\b[^>]*\bviewBox="0 0 512 512"/.test(svg), "SVG viewBox metadata mismatch");
assert(/<title>chronomap app icon<\/title>/.test(svg), "SVG title metadata missing");
assert(!/<(?:font|image|text|use)\b/i.test(svg), "SVG contains a forbidden external/font asset");
assert(!/\b(?:href|xlink:href)\s*=\s*["'][^#]/i.test(svg), "SVG references an external asset");

const pngs = new Map();
for (const [relativePath, size] of [
  ["icons/pwa-180.png", 180],
  ["icons/pwa-192.png", 192],
  ["icons/pwa-512.png", 512],
  ["icons/pwa-maskable-512.png", 512],
]) {
  const png = parsePng(await readBuffer(relativePath), relativePath);
  assert(png.width === size && png.height === size, `${relativePath} dimensions mismatch`);
  pngs.set(relativePath, png);
}

const maskable = pngs.get("icons/pwa-maskable-512.png");
const maskablePixels = decodeRgba(maskable, "icons/pwa-maskable-512.png");
assertOpaque(maskablePixels, "icons/pwa-maskable-512.png");
const safeZone = assertMaskableSafeZone(maskable, maskablePixels, "icons/pwa-maskable-512.png");

const serviceWorker = await readText("sw.js");
assert(serviceWorker.includes("precacheAndRoute"), "generated service worker is missing precache");
assert(
  serviceWorker.includes("self.skipWaiting"),
  "generated service worker is missing update hook",
);

console.log(
  `PWA build validation passed: manifest, base URLs, iOS metadata, SVG metadata, PNG metadata, ` +
    `maskable safe zone (${safeZone}), generated SW boundary, and dimensions.`,
);

import { cp, copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(".");
const validatorPath = resolve(repositoryRoot, "scripts/validate-pwa-build.mjs");
const temporaryRoots = [];

const manifest = {
  name: "chronomap — 時間旅行地図",
  short_name: "chronomap",
  lang: "ja",
  display: "standalone",
  orientation: "any",
  start_url: ".",
  scope: ".",
  share_target: {
    action: "share",
    method: "GET",
    params: { title: "title", text: "text", url: "url" },
  },
  theme_color: "#2d6cdf",
  background_color: "#f5f7fa",
  icons: [
    { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "chronomap-pwa-validator-"));
  temporaryRoots.push(root);
  const dist = join(root, "dist");
  await cp(resolve(repositoryRoot, "public/icons"), join(dist, "icons"), { recursive: true });
  await mkdir(join(dist, "assets/nested"), { recursive: true });
  await writeFile(join(dist, "manifest.webmanifest"), JSON.stringify(manifest));
  await writeFile(
    join(dist, "index.html"),
    [
      '<!doctype html><html lang="ja"><head>',
      '<link rel="manifest" href="/chronomap/manifest.webmanifest">',
      '<link rel="apple-touch-icon" sizes="180x180" href="/chronomap/icons/pwa-180.png" />',
      '<meta name="theme-color" content="#2d6cdf" />',
      '<meta name="apple-mobile-web-app-capable" content="yes" />',
      '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
      '<meta name="apple-mobile-web-app-title" content="chronomap" />',
      "</head><body></body></html>",
    ].join(""),
  );
  await writeFile(
    join(dist, "assets/main.js"),
    "import('./virtual_pwa-register-hash.js').then(({registerSW}) => registerSW({}));",
  );
  await writeFile(
    join(dist, "sw.js"),
    [
      "precacheAndRoute([{url: 'index.html'}]);",
      "registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));",
      "registerRoute(({url}) => url.origin !== self.location.origin, new NetworkOnly(), 'GET');",
      "self.skipWaiting();",
    ].join("\n"),
  );
  return { root, dist };
}

function runValidator(cwd) {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [validatorPath], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolveResult({ code, stdout, stderr }));
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("validate-pwa-build", () => {
  it("accepts a valid manifest, icon set, generated service worker, and bundle", async () => {
    const { root } = await createFixture();
    const result = await runValidator(root);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("PWA build validation passed");
  });

  it("rejects a transparent maskable icon", async () => {
    const { root, dist } = await createFixture();
    await copyFile(join(dist, "icons/pwa-512.png"), join(dist, "icons/pwa-maskable-512.png"));
    const result = await runValidator(root);

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("opaque full-canvas background");
  });

  it("rejects manifest metadata drift", async () => {
    const { root, dist } = await createFixture();
    const invalid = JSON.parse(await readFile(join(dist, "manifest.webmanifest"), "utf8"));
    invalid.name = "unexpected name";
    await writeFile(join(dist, "manifest.webmanifest"), JSON.stringify(invalid));
    const result = await runValidator(root);

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("manifest.name mismatch");
  });

  it("rejects a build without runtime service-worker registration", async () => {
    const { root, dist } = await createFixture();
    await writeFile(join(dist, "assets/main.js"), "console.log('chronomap');");
    const result = await runValidator(root);

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "runtime SW registration import was not emitted",
    );
  });
});

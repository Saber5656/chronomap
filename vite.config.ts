import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json" with { type: "json" };
import { buildContentSecurityPolicy } from "./src/security/csp";
import {
  COMMONS_PHOTOS_FEATURE_FLAG,
  isFeatureFlagEnabled,
  KONJAKU_FEATURE_FLAG,
} from "./src/security/hosts";

const APP_SHELL_GLOB_PATTERNS = ["**/*.{js,mjs,css,html,svg,png,webmanifest}"];

function maplibreWorkerAssetsPlugin(): Plugin {
  const packageDist = resolve(process.cwd(), "node_modules/maplibre-gl/dist");
  return {
    name: "chronomap-maplibre-worker-assets",
    generateBundle() {
      for (const fileName of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
        this.emitFile({
          type: "asset",
          fileName: `assets/${fileName}`,
          source: readFileSync(resolve(packageDist, fileName)),
        });
      }
    },
  };
}

function cspMetaPlugin(enableKonjaku: boolean, enableCommonsPhotos: boolean): Plugin {
  return {
    name: "chronomap-csp-meta",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const metaPattern = /<meta\b[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*>/iu;
        const meta = html.match(metaPattern)?.[0];
        if (meta === undefined) {
          throw new Error("index.html must contain the Content-Security-Policy meta tag");
        }

        const contentPattern = /(\bcontent=(['"]))[^>]*?\2/iu;
        if (!contentPattern.test(meta)) {
          throw new Error("Content-Security-Policy meta tag must have a content attribute");
        }

        const updatedMeta = meta.replace(
          contentPattern,
          `$1${buildContentSecurityPolicy({ enableKonjaku, enableCommonsPhotos })}$2`,
        );
        return html.replace(meta, updatedMeta);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, ".", "");
  const enableKonjaku = isFeatureFlagEnabled(
    {
      [KONJAKU_FEATURE_FLAG]: fileEnv[KONJAKU_FEATURE_FLAG],
    },
    KONJAKU_FEATURE_FLAG,
  );
  const enableCommonsPhotos = isFeatureFlagEnabled(
    { [COMMONS_PHOTOS_FEATURE_FLAG]: fileEnv[COMMONS_PHOTOS_FEATURE_FLAG] },
    COMMONS_PHOTOS_FEATURE_FLAG,
  );

  return {
    base: "/chronomap/",
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
      cspMetaPlugin(enableKonjaku, enableCommonsPhotos),
      maplibreWorkerAssetsPlugin(),
      VitePWA({
        // The owning service-worker issue handles runtime registration and update UI.
        registerType: "prompt",
        injectRegister: false,
        devOptions: {
          enabled: false,
        },
        workbox: {
          globPatterns: APP_SHELL_GLOB_PATTERNS,
          navigateFallback: "index.html",
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.origin !== self.location.origin,
              handler: "NetworkOnly",
            },
          ],
        },
        manifest: {
          name: "chronomap — 時間旅行地図",
          short_name: "chronomap",
          lang: "ja",
          display: "standalone",
          orientation: "any",
          start_url: ".",
          scope: ".",
          share_target: {
            action: "share",
            enctype: "application/x-www-form-urlencoded",
            method: "GET",
            params: { title: "title", text: "text", url: "url" },
          },
          protocol_handlers: [{ protocol: "geo", url: "share?text=%s" }],
          theme_color: "#2d6cdf",
          background_color: "#f5f7fa",
          icons: [
            {
              src: "icons/pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "icons/pwa-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "icons/pwa-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
  };
});

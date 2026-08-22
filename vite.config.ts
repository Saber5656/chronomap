import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json" with { type: "json" };
import { buildContentSecurityPolicy } from "./src/security/csp";
import { isFeatureFlagEnabled, KONJAKU_FEATURE_FLAG } from "./src/security/hosts";

const APP_SHELL_GLOB_PATTERNS = ["**/*.{js,css,html,svg,png,webmanifest}"];

function cspMetaPlugin(enableKonjaku: boolean): Plugin {
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
          `$1${buildContentSecurityPolicy({ enableKonjaku })}$2`,
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

  return {
    base: "/chronomap/",
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
      cspMetaPlugin(enableKonjaku),
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

import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json" with { type: "json" };

const APP_SHELL_GLOB_PATTERNS = ["**/*.{js,css,html,svg,png,webmanifest}"];

export default defineConfig({
  base: "/chronomap/",
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
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
});

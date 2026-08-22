import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/chronomap/",
  plugins: [
    VitePWA({
      // The owning service-worker issue handles runtime registration and update UI.
      registerType: "prompt",
      injectRegister: false,
      devOptions: {
        enabled: false,
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

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/commons.spec.ts"],
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-commons" }]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
  },
  webServer: {
    command:
      "VITE_E2E=true VITE_ENABLE_KONJAKU=true VITE_ENABLE_COMMONS_PHOTOS=true npm run build && npm run preview -- --host 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175/chronomap/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

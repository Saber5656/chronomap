import { defineConfig } from "@playwright/test";

const mobileProject = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  permissions: ["geolocation"] as const,
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...mobileProject, browserName: "chromium" },
    },
    {
      name: "webkit-smoke",
      grep: /@smoke/,
      use: { ...mobileProject, browserName: "webkit" },
    },
  ],
  webServer: {
    command: "VITE_E2E=true npm run build && npm run preview -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/chronomap/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

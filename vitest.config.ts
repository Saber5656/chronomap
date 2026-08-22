import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "virtual:pwa-register": resolve(import.meta.dirname, "tests/unit/mocks/pwa-register.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/unit/**/*.spec.{ts,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/util/**/*.ts",
        "src/providers/layers/resolve.ts",
        "src/state/store.ts",
        "src/security/validate.ts",
        "src/state/urlState.ts",
        "src/integrations/parseSharedLocation.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        "src/security/validate.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/state/urlState.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/integrations/parseSharedLocation.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/providers/layers/resolve.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/lib/dayparts.ts",
        "src/lib/db.ts",
        "src/lib/scans.ts",
      ],
      thresholds: {
        branches: 85,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});

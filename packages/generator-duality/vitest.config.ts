import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/__tests__/**"],
    },
  },
});

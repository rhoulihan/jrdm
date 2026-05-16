import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      thresholds: { lines: 70, branches: 65, functions: 70, statements: 70 },
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/__tests__/**"],
    },
  },
});

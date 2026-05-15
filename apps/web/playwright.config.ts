import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/__tests__",
  fullyParallel: false,
  use: { baseURL: "http://localhost:5173" },
  webServer: [
    {
      command: "pnpm --filter @jrdm/server dev",
      port: 3737,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: "pnpm dev",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

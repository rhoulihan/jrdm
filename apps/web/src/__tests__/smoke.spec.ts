// covers: apps/web/src/main.tsx (app entrypoint via index.html)
import { test, expect } from "@playwright/test";

test("app shell loads with the import form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /JRDM/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /import/i })).toBeVisible();
});

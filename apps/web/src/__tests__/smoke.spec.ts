import { test, expect } from "@playwright/test";

test("home page loads and shows server status", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("JRDM v0.1");
  await expect(page.getByTestId("status")).toContainText("ok");
});

test("preview generates DDL for orders example", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Generate DDL" }).click();
  await expect(page.getByTestId("ddl-pane")).toContainText(
    "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW",
  );
});

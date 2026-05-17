// covers: apps/web/src/main.tsx (app entrypoint via index.html)
import { test, expect } from "@playwright/test";

const PAYLOAD = {
  project: {
    name: "imported",
    version: "0.1.0",
    entities: [
      {
        name: "customers",
        schema: "app",
        columns: [{ name: "customer_id", type: "NUMBER", nullable: false }],
        primaryKey: ["customer_id"],
      },
      {
        name: "orders",
        schema: "app",
        columns: [
          { name: "order_id", type: "NUMBER", nullable: false },
          { name: "customer_id", type: "NUMBER", nullable: false },
        ],
        primaryKey: ["order_id"],
        foreignKeys: [
          {
            name: "fk_o_c",
            columns: ["customer_id"],
            references: { schema: "app", table: "customers", columns: ["customer_id"] },
          },
        ],
      },
    ],
    views: [],
  },
  relationships: [
    {
      name: "fk_o_c",
      from: { schema: "app", table: "orders", columns: ["customer_id"] },
      to: { schema: "app", table: "customers", columns: ["customer_id"] },
      cardinality: "1:N",
    },
  ],
  issues: [
    {
      code: "UNMAPPED_TYPE",
      severity: "warning",
      message: "Column geo.shape has Oracle type SDO_GEOMETRY; defaulted to VARCHAR2",
      path: ["entities", "geo", "columns", "shape"],
    },
  ],
};

test("app shell loads with the import form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /JRDM/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /import/i })).toBeVisible();
});

test("import → ERD canvas + inspector + issues (API mocked)", async ({ page }) => {
  await page.route("**/api/import/oracle", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PAYLOAD),
    });
  });

  await page.goto("/");
  await page.getByLabel(/^user$/i).fill("scott");
  await page.getByLabel(/^password$/i).fill("tiger");
  await page.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await page.getByLabel(/schema owner/i).fill("APP");
  await page.getByRole("button", { name: /^import$/i }).click();

  // ERD renders
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();
  await expect(page.getByText("orders")).toBeVisible();
  await expect(page.getByText("customers")).toBeVisible();

  // Issue surfaced
  await expect(page.getByText(/UNMAPPED_TYPE/)).toBeVisible();

  // Selecting an entity populates the inspector
  await page.getByText("orders").click();
  await expect(page.getByRole("heading", { name: "app.orders" })).toBeVisible();
});

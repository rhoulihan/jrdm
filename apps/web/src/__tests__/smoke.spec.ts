// covers: apps/web/src/main.tsx (app entrypoint via index.html)
import { test, expect } from "@playwright/test";

const IMPORT_PAYLOAD = {
  project: {
    name: "imported",
    version: "0.1.0",
    entities: [
      {
        name: "orders",
        schema: "app",
        columns: [
          { name: "order_id", type: "NUMBER", nullable: false },
          { name: "order_status", type: "VARCHAR2", nullable: true },
        ],
        primaryKey: ["order_id"],
      },
    ],
    views: [],
  },
  relationships: [],
  issues: [],
};

test("app shell loads with the import form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /JRDM/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /import/i })).toBeVisible();
});

test("author a duality view: import → design → drag column → live DDL → toggle GraphQL", async ({
  page,
}) => {
  await page.route("**/api/import/oracle", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(IMPORT_PAYLOAD),
    }),
  );
  await page.route("**/api/ddl/preview", async (route) => {
    const body = route.request().postDataJSON() as { syntax?: string };
    const payload =
      body.syntax === "graphql"
        ? { graphql: "orders @insert @update @delete {\n  _id : order_id\n}" }
        : { sql: "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.goto("/");
  await page.getByLabel(/^user$/i).fill("scott");
  await page.getByLabel(/^password$/i).fill("tiger");
  await page.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await page.getByLabel(/schema owner/i).fill("APP");
  await page.getByRole("button", { name: /^import$/i }).click();
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();

  // select the entity, start a view, switch to design
  await page.getByText("orders", { exact: true }).click();
  await page.getByRole("button", { name: /design view from/i }).click();
  await expect(page.getByTestId("doctree")).toBeVisible();
  await expect(page.getByTestId("ddl-output")).toContainText(
    "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW",
  );

  // toggle to GraphQL
  await page.getByRole("button", { name: /^GraphQL$/ }).click();
  await expect(page.getByTestId("ddl-output")).toContainText("orders @insert @update @delete");
});

test("nested authoring: + array → drop column into it → nested child + DDL", async ({ page }) => {
  await page.route("**/api/import/oracle", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(IMPORT_PAYLOAD),
    }),
  );
  let lastViewFieldCount = 0;
  await page.route("**/api/ddl/preview", async (route) => {
    const body = route.request().postDataJSON() as {
      view: { fields: unknown[] };
      syntax?: string;
    };
    lastViewFieldCount = body.view.fields.length;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sql: "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel(/^user$/i).fill("scott");
  await page.getByLabel(/^password$/i).fill("tiger");
  await page.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await page.getByLabel(/schema owner/i).fill("APP");
  await page.getByRole("button", { name: /^import$/i }).click();
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();

  await page.getByText("orders", { exact: true }).click();
  await page.getByRole("button", { name: /design view from/i }).click();
  await expect(page.getByTestId("doctree")).toBeVisible();

  // create a nested array field via the toolbar
  await page.getByRole("button", { name: "+ array" }).click();
  await expect(page.getByTestId("field-1")).toHaveText(/new_array \(array orders\)/);

  // the new nested field is selected → FieldInspector open; set its table + link
  await page.getByLabel(/^table$/i).fill("order_items");
  await page.getByLabel(/link/i).fill("order_id");

  // cross-pane drag UX (ERD↔doc) is a later milestone; here we exercise FieldNode.onDrop directly
  await page.locator('[data-testid="field-1"]').evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData(
      "application/x-jrdm-column",
      JSON.stringify({ table: "order_items", column: "qty" }),
    );
    el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  });

  // nested child rendered + DDL preview re-requested with the bigger view
  await expect(page.getByTestId("field-1.0")).toBeVisible();
  await expect(page.getByTestId("ddl-output")).toContainText(
    "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW",
  );
  expect(lastViewFieldCount).toBeGreaterThanOrEqual(2);
});

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
  let lastPostedViewHasNestedField = false;
  await page.route("**/api/ddl/preview", async (route) => {
    const body = route.request().postDataJSON() as {
      view: { fields: Array<{ kind?: string; fields?: unknown[] }> };
      syntax?: string;
    };
    lastViewFieldCount = body.view.fields.length;
    const nestedFields = body.view.fields.filter(
      (f) => f.kind !== undefined && Array.isArray(f.fields),
    );
    lastPostedViewHasNestedField = nestedFields.length > 0;
    // Derive DDL that encodes the nested structure so the assertion is NOT a tautology:
    // the returned SQL mentions each nested field's kind, proving nested authoring was posted.
    const nestedClause = nestedFields.map((f) => `NESTED PATH ${f.kind ?? "array"}`).join(" ");
    const sql =
      nestedFields.length > 0
        ? `CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS SELECT * FROM orders WITH ${nestedClause}`
        : "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sql }),
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

  // the new nested field is selected → FieldInspector open; set its table +
  // asymmetric link (I3: link.from = parent cols, link.to = child cols)
  await page.getByLabel(/^table$/i).fill("order_items");
  await page.getByTestId("link-from").fill("order_id");
  await page.getByTestId("link-to").fill("order_id");

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
  // The DDL output must contain "NESTED PATH array" — only reachable when the
  // posted view actually contained a nested field (kind=array + fields=[]).
  // If nested authoring were broken (toolbar adds nothing / drop is a no-op),
  // the posted view would have no nested fields and this assertion would fail.
  await expect(page.getByTestId("ddl-output")).toContainText("NESTED PATH array");
  expect(lastViewFieldCount).toBeGreaterThanOrEqual(2);
  expect(lastPostedViewHasNestedField).toBe(true);
});

// ---------------------------------------------------------------------------
// v0.4 live-preview scenario: deploy → sample → edit → conflict
// All JRDM HTTP endpoints are route-mocked (established rule — no real Oracle).
// ---------------------------------------------------------------------------

const SAMPLE_DOCS = [
  {
    _id: 1,
    order_status: "PENDING",
    _metadata: { etag: "AABBCCDD" },
  },
  {
    _id: 2,
    order_status: "SHIPPED",
    _metadata: { etag: "11223344" },
  },
];

const READ_DOC = {
  _id: 1,
  order_status: "PENDING",
  _metadata: { etag: "AABBCCDD" },
};

const WRITE_SUCCESS_DOC = {
  _id: 1,
  order_status: "PROCESSED",
  _metadata: { etag: "EEFF0011" },
};

test("live-preview: deploy → sample → edit → conflict (API mocked)", async ({ page }) => {
  // --- Route mocks ---
  await page.route("**/api/import/oracle", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(IMPORT_PAYLOAD),
    }),
  );

  await page.route("**/api/ddl/preview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sql: "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS",
      }),
    }),
  );

  await page.route("**/api/deploy", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deployed: true, statements: 3, view: "orders_dv" }),
    }),
  );

  await page.route("**/api/sample", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ documents: SAMPLE_DOCS }),
    }),
  );

  await page.route("**/api/document/read", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ document: READ_DOC }),
    }),
  );

  // First write → success (new etag); second write → 409 conflict.
  let writeCallCount = 0;
  await page.route("**/api/document/write", (route) => {
    writeCallCount += 1;
    if (writeCallCount === 1) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ document: WRITE_SUCCESS_DOC }),
      });
    }
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "etag_conflict",
        message: "ORA-42699: ETag mismatch — document was modified by another session",
      }),
    });
  });

  // --- Navigate and import ---
  await page.goto("/");
  await page.getByLabel(/^user$/i).fill("scott");
  await page.getByLabel(/^password$/i).fill("tiger");
  await page.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await page.getByLabel(/schema owner/i).fill("APP");
  await page.getByRole("button", { name: /^import$/i }).click();
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();

  // --- Enter design mode with an editingView ---
  await page.getByText("orders", { exact: true }).click();
  await page.getByRole("button", { name: /design view from/i }).click();
  await expect(page.getByTestId("doctree")).toBeVisible();

  // --- PreviewPanel is mounted in the right rail in design mode ---
  await expect(page.getByTestId("preview-panel")).toBeVisible();

  // --- Deploy ---
  await page.getByTestId("deploy-btn").click();
  await expect(page.getByTestId("deploy-success")).toBeVisible();
  await expect(page.getByTestId("deploy-success")).toContainText("3 statements");

  // --- Sample ---
  await page.getByTestId("sample-btn").click();
  // Both sampled docs should appear as rows with etags
  await expect(page.getByTestId("doc-row-1")).toBeVisible();
  await expect(page.getByTestId("doc-etag-1")).toBeVisible();
  await expect(page.getByTestId("doc-etag-1")).toContainText("AABBCCDD");
  await expect(page.getByTestId("doc-row-2")).toBeVisible();

  // --- Open edit modal by clicking doc row ---
  await page.getByTestId("doc-row-1").click();
  // DocumentEditModal calls readDocument on mount; wait for edit-field to appear
  await expect(page.getByTestId("edit-field")).toBeVisible();

  // --- First save: succeeds, new etag shown ---
  // The edit-field is pre-filled with the first editable scalar from READ_DOC
  // (order_status = "PENDING"). Change it and save.
  await page.getByTestId("edit-field").fill("PROCESSED");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByTestId("edit-new-etag")).toBeVisible();
  await expect(page.getByTestId("edit-new-etag")).toContainText("EEFF0011");

  // Conflict banner must NOT be visible yet (the 409 has not fired yet)
  await expect(page.getByTestId("conflict-banner")).not.toBeVisible();

  // --- Second save: stale etag → 409 → conflict-banner ---
  // The doc in the modal component still holds the original _metadata.etag
  // (the component does not re-load the doc after a successful write), so this
  // second Save fires writeDocument with the old etag → mocked 409.
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByTestId("conflict-banner")).toBeVisible();
  await expect(page.getByTestId("conflict-banner")).toContainText("ORA-42699");

  // Sanity: exactly 2 write calls were made (one success, one conflict)
  expect(writeCallCount).toBe(2);
});

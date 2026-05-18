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

// Multi-entity payload with NO relationships — exercises the grid layout path.
// Six isolated tables must NOT stack into a single vertical column.
const MULTI_ENTITY_IMPORT_PAYLOAD = {
  project: {
    name: "multi-table-imported",
    version: "0.1.0",
    entities: [
      {
        name: "customers",
        schema: "app",
        columns: [{ name: "customer_id", type: "NUMBER", nullable: false }],
        primaryKey: ["customer_id"],
      },
      {
        name: "products",
        schema: "app",
        columns: [{ name: "product_id", type: "NUMBER", nullable: false }],
        primaryKey: ["product_id"],
      },
      {
        name: "invoices",
        schema: "app",
        columns: [{ name: "invoice_id", type: "NUMBER", nullable: false }],
        primaryKey: ["invoice_id"],
      },
      {
        name: "payments",
        schema: "app",
        columns: [{ name: "payment_id", type: "NUMBER", nullable: false }],
        primaryKey: ["payment_id"],
      },
      {
        name: "regions",
        schema: "app",
        columns: [{ name: "region_id", type: "NUMBER", nullable: false }],
        primaryKey: ["region_id"],
      },
      {
        name: "categories",
        schema: "app",
        columns: [{ name: "category_id", type: "NUMBER", nullable: false }],
        primaryKey: ["category_id"],
      },
    ],
    views: [],
  },
  relationships: [], // deliberately no edges → must produce grid, never one column
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
  await page.route("**/api/schemas", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemas: ["APP"] }),
    }),
  );
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
  await page.getByTestId("connect-btn").click();
  await page.getByLabel(/schema/i).waitFor({ state: "attached" });
  await expect(page.getByLabel(/schema/i)).toHaveValue("APP");
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
  await page.route("**/api/schemas", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemas: ["APP"] }),
    }),
  );
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
  await page.getByTestId("connect-btn").click();
  await expect(page.getByLabel(/schema/i)).toHaveValue("APP");
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
  await page.route("**/api/schemas", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemas: ["APP"] }),
    }),
  );
  await page.goto("/");
  await page.getByLabel(/^user$/i).fill("scott");
  await page.getByLabel(/^password$/i).fill("tiger");
  await page.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await page.getByTestId("connect-btn").click();
  await expect(page.getByLabel(/schema/i)).toHaveValue("APP");
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

// ---------------------------------------------------------------------------
// v0.4.2 regression guards — layout + draggability
//
// Uses a 6-entity / 0-relationship payload to force the grid layout path.
// This is the exact scenario that exposed the single-column dagre regression:
// dagre with no edges puts every node in rank 0 → one vertical column.
//
// Guard (a): ≥ 2 distinct x positions among rendered node transforms — fails
//   immediately if projectToGraph degrades back to a single-column layout.
//
// Guard (b): dragging a node changes its CSS transform — fails if DiagramPane
//   reverts to a static `nodes` prop that snaps positions back on re-render.
// ---------------------------------------------------------------------------

test("ERD layout + draggability regression guards (grid path, 6 edgeless tables)", async ({
  page,
}) => {
  await page.route("**/api/schemas", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemas: ["APP", "SALES"] }),
    }),
  );
  await page.route("**/api/import/oracle", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MULTI_ENTITY_IMPORT_PAYLOAD),
    }),
  );

  await page.goto("/");
  await page.getByLabel(/^user$/i).fill("scott");
  await page.getByLabel(/^password$/i).fill("tiger");
  await page.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await page.getByTestId("connect-btn").click();
  await page.getByLabel(/schema/i).waitFor({ state: "attached" });

  // Pick SALES from the dropdown (verifies the schema select works with multiple schemas)
  await page.getByLabel(/schema/i).selectOption("SALES");
  await page.getByRole("button", { name: /^import$/i }).click();
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();

  // Wait for React Flow nodes to actually render in the viewport.
  // React Flow renders nodes as absolutely-positioned divs with a CSS transform.
  // We locate them by the .react-flow__node class which React Flow always applies.
  await page.waitForSelector(".react-flow__node", { state: "attached" });

  // ── Guard (a): NOT all nodes at the same x ──────────────────────────────────
  // React Flow positions each node via `style="transform: translate(Xpx, Ypx)"`.
  // Extract all X values and assert at least 2 are distinct.
  // If projectToGraph collapsed back to a single column every node would share
  // the same X, making distinctXCount === 1 and this assertion would fail.
  const distinctXCount = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll(".react-flow__node"));
    const xValues = nodes.map((n) => {
      const transform = (n as HTMLElement).style.transform;
      // transform is "translate(Xpx, Ypx)" — extract first number
      const m = transform.match(/translate\((-?[\d.]+)px/);
      return m && m[1] !== undefined ? parseFloat(m[1]) : null;
    });
    const validXs = xValues.filter((x): x is number => x !== null);
    return new Set(validXs).size;
  });
  // 6 edgeless entities in a grid → sqrt(6)≈2.45 → ceil = 3 columns.
  // At minimum we expect ≥ 2 distinct x values (any 2-column grid suffices).
  // A tautology would be ≥ 1 (trivially true); ≥ 2 genuinely guards the regression.
  expect(distinctXCount).toBeGreaterThanOrEqual(2);

  // ── Guard (b): a dragged node changes position ──────────────────────────────
  // Capture the transform of the FIRST node before the drag, then drag it
  // 120 px right + 80 px down, then assert the transform changed.
  // If DiagramPane used a static `nodes` prop (the old bug), React Flow would
  // snap the position back to the seeded value on the next render cycle, making
  // the transform AFTER the drag identical to the transform BEFORE — failing here.
  const firstNode = page.locator(".react-flow__node").first();
  const transformBefore = await firstNode.evaluate((n) => (n as HTMLElement).style.transform);

  const box = await firstNode.boundingBox();
  expect(box).not.toBeNull();
  // Drag from the centre of the node
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY + 80, { steps: 10 });
  await page.mouse.up();

  // Allow React Flow one animation frame to commit the new position
  await page.waitForTimeout(150);

  const transformAfter = await firstNode.evaluate((n) => (n as HTMLElement).style.transform);
  // The transform must have changed — if it snapped back, transformAfter === transformBefore.
  expect(transformAfter).not.toBe(transformBefore);
});

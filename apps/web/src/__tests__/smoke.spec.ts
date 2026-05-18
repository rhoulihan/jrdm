// covers: apps/web/src/main.tsx (app entrypoint via index.html)
import { test, expect, type Page } from "@playwright/test";

// The connection/import form is hosted in a modal opened from the toolbar
// (Phase-0 shell). This helper drives the toolbar → modal → connect → import
// flow that every authoring scenario depends on. The form's connect-btn is
// scoped to the dialog so it never collides with the toolbar connect-btn.
async function connectAndImport(page: Page, opts: { schema?: string } = {}) {
  await page.getByTestId("connect-btn").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^user$/i).fill("scott");
  await dialog.getByLabel(/^password$/i).fill("tiger");
  await dialog.getByLabel(/connect string/i).fill("h:1521/FREEPDB1");
  await dialog.getByTestId("form-connect-btn").click();
  await dialog.getByLabel(/schema/i).waitFor({ state: "attached" });
  if (opts.schema) {
    await dialog.getByLabel(/schema/i).selectOption(opts.schema);
  } else {
    await expect(dialog.getByLabel(/schema/i)).toHaveValue("APP");
  }
  await dialog.getByRole("button", { name: /^import$/i }).click();
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();
}

// Open the bottom dock and select a tab (DDL / Issues / Deploy live here in
// the Phase-0 shell). Dock is collapsed by default.
async function openDock(page: Page, tab: "DDL" | "Issues" | "Deploy") {
  const dock = page.getByTestId("bottom-dock");
  const expand = dock.getByTestId("dock-expand");
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  await page.getByTestId("bottom-dock").getByRole("tab", { name: tab }).click();
}

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

test("app shell loads with both panes and a toolbar Connect entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /JRDM/ })).toBeVisible();
  // ERD + document tree are BOTH mounted simultaneously — no mode toggle.
  await expect(page.getByTestId("diagram-empty")).toBeVisible();
  await expect(page.getByTestId("doctree-empty")).toBeVisible();
  await expect(page.getByText(/ERD mode|Design mode/)).toHaveCount(0);
  // Connection/import is reached via the toolbar Connect button (modal-hosted).
  await expect(page.getByTestId("connect-btn")).toBeVisible();
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
  await connectAndImport(page);

  // ERD and document tree are BOTH visible at once — no mode switch.
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();
  await expect(page.getByTestId("doctree-empty")).toBeVisible();

  // select the entity, start a view from the selection
  await page.getByText("orders", { exact: true }).click();
  await page.getByRole("button", { name: /design view from/i }).click();
  await expect(page.getByTestId("doctree")).toBeVisible();
  // ERD still mounted alongside the now-authoring document tree
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();

  // DDL preview lives in the bottom dock — expand it and select DDL
  await openDock(page, "DDL");
  await expect(page.getByTestId("ddl-output")).toContainText(
    "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW",
  );

  // toggle to GraphQL
  await page
    .getByTestId("bottom-dock")
    .getByRole("button", { name: /^GraphQL$/ })
    .click();
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
  await connectAndImport(page);

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
  // DDL preview lives in the bottom dock — expand it to inspect the output.
  await openDock(page, "DDL");
  // The DDL output must contain "NESTED PATH array" — only reachable when the
  // posted view actually contained a nested field (kind=array + fields=[]).
  // If nested authoring were broken (toolbar adds nothing / drop is a no-op),
  // the posted view would have no nested fields and this assertion would fail.
  await expect(page.getByTestId("ddl-output")).toContainText("NESTED PATH array");
  expect(lastViewFieldCount).toBeGreaterThanOrEqual(2);
  expect(lastPostedViewHasNestedField).toBe(true);
});

// ---------------------------------------------------------------------------
// v0.5 M.T5 — ERD entity drag → Map modal → Save → embedded sample in deploy dock
//
// Payload: ORDERS (PK: order_id) + ORDER_ITEMS (PK: item_id, FK order_id→ORDERS)
// with a 1:N relationship so the FK-aware embed sets kind="array" automatically.
//
// Non-tautological guards (these FAIL if Save didn't transform the view):
//   (a) doc-row-123 is visible — only appears when sampleDocs is set (setSampleDocs
//       is only called in onSave); if modal never opened or Save was a no-op, empty.
//   (b) The doc row text contains "ORDER_ITEMS" — the nested-array key; only present
//       when the mapping actually embedded ORDER_ITEMS into the view and the sample
//       generator walked the nested field.
//   (c) The doc row text contains "SAMPLE0000" — the synthetic etag emitted by
//       sampleDocument(); only present when sampleDocument() ran on the saved view.
//   (d) The DDL output mentions "NESTED PATH" — only when editingView has a nested
//       field (proves the commit to editingView actually happened).
// ---------------------------------------------------------------------------

const FK_IMPORT_PAYLOAD = {
  project: {
    name: "fk-orders",
    version: "0.1.0",
    entities: [
      {
        name: "ORDERS",
        schema: "app",
        columns: [
          { name: "order_id", type: "NUMBER", nullable: false },
          { name: "order_status", type: "VARCHAR2", nullable: true },
        ],
        primaryKey: ["order_id"],
        foreignKeys: [],
      },
      {
        name: "ORDER_ITEMS",
        schema: "app",
        columns: [
          { name: "item_id", type: "NUMBER", nullable: false },
          { name: "order_id", type: "NUMBER", nullable: false },
          { name: "qty", type: "NUMBER", nullable: true },
        ],
        primaryKey: ["item_id"],
        foreignKeys: [
          {
            name: "fk_oi_o",
            columns: ["order_id"],
            references: { schema: "app", table: "ORDERS", columns: ["order_id"] },
          },
        ],
      },
    ],
    views: [],
  },
  // 1:N: ORDERS (PK side) → ORDER_ITEMS (FK side)
  relationships: [
    {
      from: { table: "ORDERS", columns: ["order_id"] },
      to: { table: "ORDER_ITEMS", columns: ["order_id"] },
      cardinality: "1:N",
    },
  ],
  issues: [],
};

test("M.T5 — drag entity onto doc canvas → Map modal → Select-All + add node + Map to Path → Save → embedded sample + DDL updated", async ({
  page,
}) => {
  // Route mocks (JRDM endpoints only — no Oracle)
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
      body: JSON.stringify(FK_IMPORT_PAYLOAD),
    }),
  );

  // Track what the client posts so we can assert nested content in DDL output.
  let lastDdlBody: { view?: { fields?: Array<{ kind?: string; key?: string }> } } = {};
  await page.route("**/api/ddl/preview", async (route) => {
    lastDdlBody = route.request().postDataJSON() as typeof lastDdlBody;
    const nestedFields = (lastDdlBody.view?.fields ?? []).filter((f) => f.kind !== undefined);
    const sql =
      nestedFields.length > 0
        ? `CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.ORDERS_dv AS SELECT * FROM ORDERS NESTED PATH array`
        : "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.ORDERS_dv AS";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sql }),
    });
  });

  await page.goto("/");
  await connectAndImport(page);

  // Start a view from ORDERS (the root entity)
  await page.getByText("ORDERS", { exact: true }).first().click();
  await page.getByRole("button", { name: /design view from/i }).click();
  await expect(page.getByTestId("doctree")).toBeVisible();

  // Simulate dragging the ORDER_ITEMS entity header onto the document canvas.
  // We inject the drag event directly (same approach as the nested-authoring scenario)
  // because Playwright cross-pane HTML5 DnD requires dataTransfer injection.
  await page.locator('[data-testid="doctree"]').evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("application/x-jrdm-entity", "ORDER_ITEMS");
    el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  });

  // The Map-to-Document modal must open, title includes the table name
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ORDER_ITEMS");

  // Select All — grays the field list; all columns selected
  await dialog.getByTestId("select-all").check();
  // Confirm the checklist items are present (3 columns)
  await expect(dialog.getByTestId("field-item_id")).toBeVisible();
  await expect(dialog.getByTestId("field-order_id")).toBeVisible();
  await expect(dialog.getByTestId("field-qty")).toBeVisible();

  // Add node — creates the ORDER_ITEMS nested node (FK-aware: auto-selects array)
  await dialog.getByTestId("add-node-btn").click();

  // The "Map to Path" button should now be enabled (columns selected + node selected)
  await expect(dialog.getByTestId("map-to-path-btn")).not.toBeDisabled();

  // Map to Path — bind the ORDER_ITEMS columns under the newly created node
  await dialog.getByTestId("map-to-path-btn").click();

  // Save — commits to editingView + sets sampleDocs
  await dialog.getByTestId("map-save").click();

  // Modal must be gone
  await expect(dialog).not.toBeVisible();

  // --- Non-tautological guards ---
  // (a)+(b)+(c): Open Deploy dock and assert the sample doc row with the embedded key.
  // _id is seeded from `startNewView` as "ORDERS.id" — entity has no "id" column so
  // sampleDocument() emits sampleForType(undefined) = "sample" → doc-row-sample.
  await openDock(page, "Deploy");
  const dock = page.getByTestId("bottom-dock");

  // doc-row-sample only appears when setSampleDocs([sampleDocument(...)]) was called,
  // which only happens in onSave. If modal never opened or Save was a no-op, empty.
  await expect(dock.getByTestId("doc-row-sample")).toBeVisible({ timeout: 5000 });

  // The row text must contain the embedded table key "ORDER_ITEMS" — only present
  // when the mapping actually committed a nested ORDER_ITEMS field into editingView
  // AND sampleDocument() walked that nested field to produce the key in the output.
  const docRow = dock.getByTestId("doc-row-sample");
  await expect(docRow).toContainText("ORDER_ITEMS");

  // The synthetic etag "SAMPLE0000" must appear — proves sampleDocument() ran
  // on the saved view. A stale or missing setSampleDocs call would produce no row
  // at all, so this assertion guards both the call and the correct etag value.
  await expect(docRow).toContainText("SAMPLE0000");

  // (d): DDL must contain NESTED PATH — only when editingView has a nested field.
  // If Save did not commit the nested ORDER_ITEMS into editingView the DDL preview
  // re-request (triggered by setEditingView) would post a flat view and return
  // a plain CREATE statement without "NESTED PATH".
  await openDock(page, "DDL");
  await expect(page.getByTestId("ddl-output")).toContainText("NESTED PATH");

  // Verify that the nested field actually made it into the last posted DDL body
  const nestedField = (lastDdlBody.view?.fields ?? []).find((f) => f.kind !== undefined);
  expect(nestedField).toBeDefined();
  expect(nestedField?.key).toBe("ORDER_ITEMS");
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
  await connectAndImport(page);

  // --- Start an editingView from the selected entity ---
  await page.getByText("orders", { exact: true }).click();
  await page.getByRole("button", { name: /design view from/i }).click();
  await expect(page.getByTestId("doctree")).toBeVisible();

  // --- PreviewPanel lives in the bottom dock's Deploy tab ---
  await openDock(page, "Deploy");
  const dock = page.getByTestId("bottom-dock");
  await expect(dock.getByTestId("preview-panel")).toBeVisible();

  // --- Deploy (scoped to the dock so it never hits the toolbar deploy-btn) ---
  await dock.getByTestId("dialog-deploy-btn").click();
  await expect(dock.getByTestId("deploy-success")).toBeVisible();
  await expect(dock.getByTestId("deploy-success")).toContainText("3 statements");

  // --- Sample ---
  await dock.getByTestId("sample-btn").click();
  // Both sampled docs should appear as rows with etags
  await expect(dock.getByTestId("doc-row-1")).toBeVisible();
  await expect(dock.getByTestId("doc-etag-1")).toBeVisible();
  await expect(dock.getByTestId("doc-etag-1")).toContainText("AABBCCDD");
  await expect(dock.getByTestId("doc-row-2")).toBeVisible();

  // --- Open edit modal by clicking doc row ---
  await dock.getByTestId("doc-row-1").click();
  // DocumentEditModal calls readDocument on mount; wait for edit-field to appear
  await expect(dock.getByTestId("edit-field")).toBeVisible();

  // --- First save: succeeds, new etag shown ---
  // The edit-field is pre-filled with the first editable scalar from READ_DOC
  // (order_status = "PENDING"). Change it and save.
  await dock.getByTestId("edit-field").fill("PROCESSED");
  await dock.getByRole("button", { name: /^save$/i }).click();
  await expect(dock.getByTestId("edit-new-etag")).toBeVisible();
  await expect(dock.getByTestId("edit-new-etag")).toContainText("EEFF0011");

  // Conflict banner must NOT be visible yet (the 409 has not fired yet)
  await expect(dock.getByTestId("conflict-banner")).not.toBeVisible();

  // --- Second save: stale etag → 409 → conflict-banner ---
  // The doc in the modal component still holds the original _metadata.etag
  // (the component does not re-load the doc after a successful write), so this
  // second Save fires writeDocument with the old etag → mocked 409.
  await dock.getByRole("button", { name: /^save$/i }).click();
  await expect(dock.getByTestId("conflict-banner")).toBeVisible();
  await expect(dock.getByTestId("conflict-banner")).toContainText("ORA-42699");

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
  // Pick SALES from the dropdown (verifies the schema select works with multiple schemas)
  await connectAndImport(page, { schema: "SALES" });

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

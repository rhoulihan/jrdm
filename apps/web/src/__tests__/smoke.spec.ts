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

// FK-relationship payload for the entity context-menu + Map-to-Document e2e.
// Two related tables (ORDERS 1:N ORDER_ITEMS) so the FK-aware embed rule fires
// and the modal can be exercised through to Save.
const FK_IMPORT_PAYLOAD = {
  project: {
    name: "orders-demo",
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
        foreignKeys: [],
      },
      {
        name: "order_items",
        schema: "app",
        columns: [
          { name: "item_id", type: "NUMBER", nullable: false },
          { name: "order_id", type: "NUMBER", nullable: false },
          { name: "sku", type: "VARCHAR2", nullable: true },
        ],
        primaryKey: ["item_id"],
        foreignKeys: [{ columns: ["order_id"], refTable: "orders", refColumns: ["order_id"] }],
      },
    ],
    views: [],
  },
  relationships: [
    {
      from: { table: "orders", columns: ["order_id"] },
      to: { table: "order_items", columns: ["order_id"] },
      cardinality: "1:N",
    },
  ],
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

test("author a duality view: import → design → live DDL → toggle GraphQL", async ({ page }) => {
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

// ---------------------------------------------------------------------------
// ER.T4 — entity context-menu (right-click + ⋯) + Map-to-Document e2e
//
// Drives the complete context-menu authoring flow from import through Save
// using JRDM-endpoint mocks only (never real Oracle). Verifies:
//   • right-click AND ⋯ button each open the 4-item context menu
//   • "Map to document…" is aria-disabled (+ tooltip) with no root view
//   • "New duality view from this table" opens the modal in create-root mode; Save creates the root (doctree appears)
//   • after root exists, "New duality view…" is disabled; "Map to document…" is enabled for other entities
//   • Reset view button appears in Toolbar after a view is created
//   • opening the modal → Select All → + add node → Map to Path → Save
//     produces doc-row-sample in the Deploy dock with the embedded table key
//     ("order_items") AND the synthetic etag ("SAMPLE0000") — fails if Save
//     was a no-op or the sample generator did not run (non-tautological)
//   • Hide from canvas removes the node; show-hidden restores it
//   • no entity or column element carries the HTML `draggable` attribute
//     (per-column quick-drag retired in ER.T3) while v0.4.2 node-reposition
//     guard (React Flow drag) stays in its own separate test and is not weakened
// ---------------------------------------------------------------------------

test("entity context-menu: right-click / ⋯ → menu items / gating / new-view / map-modal → Save → sample / hide-show / no-draggable", async ({
  page,
}) => {
  // Route mocks — JRDM endpoints only, no real Oracle.
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
  await page.route("**/api/ddl/preview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sql: "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS ORDERS NESTED PATH order_items",
      }),
    }),
  );

  await page.goto("/");
  await connectAndImport(page);

  // Canvas must be visible, document tree still empty.
  await expect(page.getByTestId("diagram-canvas")).toBeVisible();
  await expect(page.getByTestId("doctree-empty")).toBeVisible();

  // ── 1. Right-click on the "orders" entity node ──────────────────────────
  // React Flow renders nodes as .react-flow__node divs; right-clicking one
  // fires onNodeContextMenu on DiagramPane which opens the ContextMenu.
  const ordersNode = page.locator(".react-flow__node").filter({ hasText: "orders" }).first();
  await ordersNode.waitFor({ state: "visible" });
  await ordersNode.click({ button: "right" });

  // Context menu must appear with all 4 items.
  const ctxMenu = page.getByTestId("entity-context-menu");
  await expect(ctxMenu).toBeVisible();
  await expect(page.getByTestId("ctxitem-map-to-document")).toBeVisible();
  await expect(page.getByTestId("ctxitem-new-duality-view-from-this-table")).toBeVisible();
  await expect(page.getByTestId("ctxitem-inspect-table")).toBeVisible();
  await expect(page.getByTestId("ctxitem-hide-from-canvas")).toBeVisible();

  // ── 2. "Map to document…" must be disabled (no root view yet) ───────────
  const mapItem = page.getByTestId("ctxitem-map-to-document");
  await expect(mapItem).toHaveAttribute("aria-disabled", "true");
  // Tooltip text is set via the `title` attribute on the button element.
  const titleAttr = await mapItem.getAttribute("title");
  expect(titleAttr).toContain("Create a root view first");

  // "New duality view from this table" must be enabled (no aria-disabled).
  const newViewItem = page.getByTestId("ctxitem-new-duality-view-from-this-table");
  await expect(newViewItem).not.toHaveAttribute("aria-disabled", "true");

  // ── 3. Click "New duality view from this table" → modal opens (NV.T3) ────
  // Clicking now opens the Map-to-Document modal in create-root mode
  // (editingView===null → create-root), rather than calling startNewView directly.
  await newViewItem.click();
  // The context menu should close.
  await expect(ctxMenu).not.toBeVisible();

  // The modal should now be visible (create-root mode).
  const newViewModal = page.getByTestId("map-to-document");
  await expect(newViewModal).toBeVisible();

  // In create-root mode the +/- path-building buttons are disabled.
  const addNodeBtnCreateRoot = page.getByTestId("add-node-btn");
  await expect(addNodeBtnCreateRoot).toBeDisabled();

  // Save the modal (even with no fields selected — just creates the root entity).
  await page.getByTestId("map-save").click();

  // Modal closes; doctree now appears (editingView was set by Save).
  await expect(newViewModal).not.toBeVisible();
  await expect(page.getByTestId("doctree")).toBeVisible();

  // ── 3a. NV.T3: After creating a view, "New duality view…" is DISABLED ────
  // Reset view button should now be visible in the Toolbar.
  await expect(page.getByTestId("reset-view")).toBeVisible();

  // Right-click orders again to verify new-view item is now disabled.
  await ordersNode.click({ button: "right" });
  await expect(ctxMenu).toBeVisible();
  const newViewItemAfterCreate = page.getByTestId("ctxitem-new-duality-view-from-this-table");
  await expect(newViewItemAfterCreate).toHaveAttribute("aria-disabled", "true");
  await expect(newViewItemAfterCreate).toHaveAttribute(
    "title",
    "Reset the current view to start a new one",
  );
  // Close the menu.
  await page.keyboard.press("Escape");
  await expect(ctxMenu).not.toBeVisible();

  // ── 4. Open the context menu via the ⋯ button for "order_items" ─────────
  // The ⋯ button is the visible affordance on the entity header (EntityNode).
  const ellipsisBtn = page.getByTestId("entity-menu-order_items");
  await ellipsisBtn.waitFor({ state: "visible" });
  await ellipsisBtn.click();

  await expect(ctxMenu).toBeVisible();

  // Now that a root view exists, "Map to document…" MUST be enabled.
  const mapItemAfterRoot = page.getByTestId("ctxitem-map-to-document");
  await expect(mapItemAfterRoot).not.toHaveAttribute("aria-disabled", "true");

  // ── 5. Click "Map to document…" → modal opens ───────────────────────────
  await mapItemAfterRoot.click();
  await expect(ctxMenu).not.toBeVisible();

  const modal = page.getByTestId("map-to-document");
  await expect(modal).toBeVisible();

  // ── 6. Select All columns in the FieldChecklist ──────────────────────────
  const selectAllCheckbox = page.getByTestId("select-all");
  await selectAllCheckbox.check();
  // The field list should exist (the checklist renders the columns).
  await expect(page.getByTestId("field-list")).toBeVisible();

  // ── 7. + add node → creates the embed location in the MappingTree ────────
  const addNodeBtn = page.getByTestId("add-node-btn");
  await addNodeBtn.click();

  // A tree node for order_items should appear in the mapping tree.
  // MappingTree testids are path-based: mnode-<path.join(".")>.
  // After seeding from the "orders" root view (which has _id at index 0),
  // the order_items subnode is appended at index 1 → testid "mnode-1".
  await expect(page.getByTestId("mapping-tree")).toBeVisible();
  // Assert by the field label text (more readable and layout-independent):
  await expect(page.getByTestId("mapping-tree")).toContainText("order_items");

  // ── 8. Map to Path → binds the selected columns to the node ─────────────
  const mapToPathBtn = page.getByTestId("map-to-path-btn");
  await expect(mapToPathBtn).not.toBeDisabled();
  await mapToPathBtn.click();

  // ── 9. Save → editingView committed + sampleDocs populated ───────────────
  await page.getByTestId("map-save").click();

  // The modal should close.
  await expect(modal).not.toBeVisible();

  // The sample document is now in the store (setSampleDocs was called in onSave).
  // It appears in the Deploy dock → ResultsPane as doc-row-<_id>.
  // sampleDocument generates _id=123 (NUMBER type for order_id).
  // Open the Deploy dock to verify.
  await openDock(page, "Deploy");
  const dock = page.getByTestId("bottom-dock");

  // Non-tautological assertions (each independently fails if Save was a no-op):
  // (a) doc-row-sample exists — only if setSampleDocs was called with a valid doc.
  // The root _id sources from "orders.id" which does not exist as a column name
  // in the fixture (column is "order_id"), so sampleDocument emits _id="sample".
  await expect(dock.getByTestId("doc-row-sample")).toBeVisible();

  // (b) The rendered doc contains the embedded table key "order_items" — only
  //     if the nested field was committed to editingView AND sampleDocument
  //     walked the nested structure.
  await expect(dock.getByTestId("doc-row-sample")).toContainText("order_items");

  // (c) SAMPLE0000 etag — comes ONLY from sampleDocument(), not from /api/sample.
  await expect(dock.getByTestId("doc-etag-sample")).toContainText("SAMPLE0000");

  // (d) DDL updates with NESTED PATH — only when editingView has a nested field.
  await openDock(page, "DDL");
  await expect(page.getByTestId("ddl-output")).toContainText("NESTED PATH");

  // ── 10. Hide from canvas ──────────────────────────────────────────────────
  // Right-click orders node again to open the menu.
  await ordersNode.click({ button: "right" });
  await expect(ctxMenu).toBeVisible();
  await page.getByTestId("ctxitem-hide-from-canvas").click();

  // The orders node must no longer be in the DOM.
  await expect(ordersNode).not.toBeVisible();

  // The "show-hidden" control must appear.
  const showHidden = page.getByTestId("show-hidden");
  await expect(showHidden).toBeVisible();
  await expect(showHidden).toContainText("Show hidden");

  // Click show-hidden → orders node returns.
  await showHidden.click();
  await expect(ordersNode).toBeVisible();
  await expect(showHidden).not.toBeVisible();

  // ── 11. No draggable entity or column elements ────────────────────────────
  // ER.T3 retired the native HTML5 drag. Assert that no element inside the
  // diagram canvas carries the `draggable` attribute (the retired source).
  // React Flow node-reposition is pointer-based (not the `draggable` attribute)
  // so this check does NOT conflict with v0.4.2 guard (b) in its own test.
  const draggableCount = await page.getByTestId("diagram-canvas").locator("[draggable]").count();
  expect(draggableCount).toBe(0);
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

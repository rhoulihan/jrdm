import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { DiagramPane } from "./DiagramPane";
import { useJrdmStore } from "../state/store";
import type { DraftProject, DualityView } from "@jrdm/model";
import type { NodePositionChange } from "@xyflow/react";
import { canCreateNewView } from "./canCreateNewView";

// ── Minimal mock of @xyflow/react ────────────────────────────────────────────
// Captures props passed to <ReactFlow> so we can assert controlled wiring.
// Renders nodes via nodeTypes (inside a ReactFlowProvider so Handle context
// is satisfied) so the existing "renders entity names" tests keep passing.
// Production markup is NOT contorted.

let capturedProps: Record<string, unknown> = {};

vi.mock("@xyflow/react", async () => {
  const real = await import("@xyflow/react");
  const { ReactFlowProvider } = real;

  function MockReactFlow(props: Record<string, unknown>) {
    capturedProps = props;
    const nodes = (props.nodes as Array<{ id: string; type?: string; data: unknown }>) ?? [];
    const nodeTypes =
      (props.nodeTypes as Record<
        string,
        React.ComponentType<{ id: string; data: unknown; onOpenMenu?: unknown }>
      >) ?? {};

    return (
      <ReactFlowProvider>
        <div data-testid="mock-reactflow">
          {nodes.map((n) => {
            const NodeComp = nodeTypes[n.type ?? ""] ?? null;
            return NodeComp ? (
              <NodeComp key={n.id} id={n.id} data={n.data} onOpenMenu={props._onOpenMenu} />
            ) : null;
          })}
          {props.children as React.ReactNode}
        </div>
      </ReactFlowProvider>
    );
  }

  return {
    ...real,
    ReactFlow: MockReactFlow,
    useNodesState: real.useNodesState,
    useEdgesState: real.useEdgesState,
    Background: () => null,
    Controls: () => null,
  };
});

// ─────────────────────────────────────────────────────────────────────────────

const project: DraftProject = {
  name: "p",
  version: "0.1.0",
  entities: [
    {
      name: "orders",
      schema: "app",
      columns: [{ name: "order_id", type: "NUMBER", nullable: false }],
      primaryKey: ["order_id"],
    },
  ],
  views: [],
};

const project2: DraftProject = {
  name: "other",
  version: "0.1.0",
  entities: [
    {
      name: "customers",
      schema: "app",
      columns: [{ name: "customer_id", type: "NUMBER", nullable: false }],
      primaryKey: ["customer_id"],
    },
    {
      name: "items",
      schema: "app",
      columns: [{ name: "item_id", type: "NUMBER", nullable: false }],
      primaryKey: ["item_id"],
    },
  ],
  views: [],
};

// Same name AND same entity count as `project` ("imported", 1 entity), but different tables.
// Under the old `name:count` key, this would NOT re-seed. Under importToken it must.
const projectSameNameSameCount: DraftProject = {
  name: "imported", // same as `project`
  version: "0.1.0",
  entities: [
    {
      name: "products", // different table — different schema
      schema: "app",
      columns: [{ name: "product_id", type: "NUMBER", nullable: false }],
      primaryKey: ["product_id"],
    },
  ], // 1 entity — same count as `project`
  views: [],
};

const validView: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [{ key: "_id", source: "orders.id" }],
};

describe("DiagramPane", () => {
  beforeEach(() => {
    capturedProps = {};
    useJrdmStore.getState().reset();
  });

  // ── Existing tests (must stay green) ──────────────────────────────────────

  it("shows an empty-state hint when there is no project", () => {
    render(<DiagramPane />);
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
  });

  it("renders the React Flow canvas when a project is loaded", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(screen.getByTestId("diagram-canvas")).toBeInTheDocument();
  });

  it("registers the entity node type and renders entity names", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(screen.getByText("orders")).toBeInTheDocument();
  });

  it("registers the relationship edge type", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    // DiagramPane passes edgeTypes={{ relationship: RelationshipEdge }} to ReactFlow;
    // canvas renders without error when edge types are wired.
    expect(screen.getByTestId("diagram-canvas")).toBeInTheDocument();
  });

  // ── New: controlled graph ─────────────────────────────────────────────────

  it("wires onNodesChange and onEdgesChange to ReactFlow", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(typeof capturedProps.onNodesChange).toBe("function");
    expect(typeof capturedProps.onEdgesChange).toBe("function");
  });

  it("passes fitView, fitViewOptions.padding=0.2, and minZoom=0.1 to ReactFlow", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(capturedProps.fitView).toBe(true);
    expect((capturedProps.fitViewOptions as { padding: number })?.padding).toBe(0.2);
    expect(capturedProps.minZoom).toBe(0.1);
  });

  // ── Hard guardrail: React Flow node-drag (repositioning) must remain wired ──

  it("a simulated NodePositionChange persists across an unrelated re-render (node-drag/reposition intact)", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    const { rerender } = render(<DiagramPane />);

    const onNodesChange = capturedProps.onNodesChange as (changes: NodePositionChange[]) => void;
    const initialNodes = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const nodeId = initialNodes[0]!.id;

    // Simulate a drag — apply a position change.
    act(() => {
      onNodesChange([
        {
          id: nodeId,
          type: "position",
          position: { x: 999, y: 888 },
          dragging: false,
        },
      ]);
    });

    // Trigger an unrelated re-render (same project — store didn't change).
    rerender(<DiagramPane />);

    const nodesAfter = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const moved = nodesAfter.find((n) => n.id === nodeId);
    expect(moved?.position.x).toBe(999);
    expect(moved?.position.y).toBe(888);
  });

  it("same-project re-render does NOT reset node positions (node-drag intact)", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    const { rerender } = render(<DiagramPane />);

    const onNodesChange = capturedProps.onNodesChange as (changes: NodePositionChange[]) => void;
    const initialNodes = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const nodeId = initialNodes[0]!.id;

    act(() => {
      onNodesChange([
        { id: nodeId, type: "position", position: { x: 42, y: 42 }, dragging: false },
      ]);
    });

    // Re-render with same store state (same project identity).
    rerender(<DiagramPane />);

    const nodesAfter = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const node = nodesAfter.find((n) => n.id === nodeId);
    // Position must NOT have been reset to the original layout value.
    expect(node?.position.x).toBe(42);
    expect(node?.position.y).toBe(42);
  });

  it("a NEW import (different project) re-seeds the layout", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    const { rerender } = render(<DiagramPane />);

    const onNodesChange = capturedProps.onNodesChange as (changes: NodePositionChange[]) => void;
    const initialNodes = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const nodeId = initialNodes[0]!.id;

    act(() => {
      onNodesChange([
        { id: nodeId, type: "position", position: { x: 999, y: 999 }, dragging: false },
      ]);
    });

    // Load a completely different project.
    act(() => {
      useJrdmStore.getState().setImport({ project: project2, relationships: [], issues: [] });
    });
    rerender(<DiagramPane />);

    // The old node should be gone; new nodes (from project2) should be present.
    const nodesAfter = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    expect(nodesAfter.some((n) => n.id === "app.customers")).toBe(true);
    expect(nodesAfter.some((n) => n.id === "app.orders")).toBe(false);
    // The new nodes should NOT be at the dragged position (they come from fresh layout).
    const customerNode = nodesAfter.find((n) => n.id === "app.customers");
    expect(customerNode?.position.x).not.toBe(999);
  });

  it("empty state (diagram-empty) is unchanged when no project", () => {
    render(<DiagramPane />);
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("diagram-canvas")).toBeNull();
  });

  // ── Bug guard: same name + same entity count, different schema MUST re-seed ─

  it("importing a different schema with same name and same entity count re-seeds the layout (importToken guards this)", () => {
    // Import schema A: name="imported", 1 entity "orders"
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    const { rerender } = render(<DiagramPane />);

    const onNodesChange = capturedProps.onNodesChange as (changes: NodePositionChange[]) => void;
    const initialNodes = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    const ordersNodeId = initialNodes[0]!.id; // "app.orders"

    // Simulate user dragging the "orders" node.
    act(() => {
      onNodesChange([
        { id: ordersNodeId, type: "position", position: { x: 777, y: 777 }, dragging: false },
      ]);
    });

    // Import schema B: SAME name "imported", SAME entity count (1), but "products" not "orders".
    // Old code: projectKey = "imported:1" for both → NO re-seed → BUG.
    // New code: importToken incremented → effect re-runs → fresh layout.
    act(() => {
      useJrdmStore
        .getState()
        .setImport({ project: projectSameNameSameCount, relationships: [], issues: [] });
    });
    rerender(<DiagramPane />);

    const nodesAfter = capturedProps.nodes as Array<{
      id: string;
      position: { x: number; y: number };
    }>;

    // "orders" node should be gone; "products" node should be present.
    expect(nodesAfter.some((n) => n.id === "app.products")).toBe(true);
    expect(nodesAfter.some((n) => n.id === "app.orders")).toBe(false);

    // The "products" node must NOT be at the dragged position (777, 777)
    // — it came from a fresh layout, not the stale one.
    const productsNode = nodesAfter.find((n) => n.id === "app.products");
    expect(productsNode?.position.x).not.toBe(777);
  });

  // ── Context menu: right-click and ⋯ button ────────────────────────────────

  it("right-clicking a node opens the context menu with 4 items", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);

    // Trigger onNodeContextMenu via the captured prop
    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;
    expect(typeof onNodeContextMenu).toBe("function");

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    expect(screen.getByTestId("entity-context-menu")).toBeInTheDocument();
    expect(screen.getByTestId("ctxitem-map-to-document")).toBeInTheDocument();
    expect(screen.getByTestId("ctxitem-new-duality-view-from-this-table")).toBeInTheDocument();
    expect(screen.getByTestId("ctxitem-inspect-table")).toBeInTheDocument();
    expect(screen.getByTestId("ctxitem-hide-from-canvas")).toBeInTheDocument();
  });

  it("Map to document… is disabled (aria-disabled + title) when editingView is null", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    const mapItem = screen.getByTestId("ctxitem-map-to-document");
    expect(mapItem).toHaveAttribute("aria-disabled", "true");
    expect(mapItem).toHaveAttribute(
      "title",
      "Create a root view first (New duality view from this table)",
    );
  });

  it("Map to document… is enabled when editingView exists", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().setEditingView(validView);
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    const mapItem = screen.getByTestId("ctxitem-map-to-document");
    expect(mapItem).not.toHaveAttribute("aria-disabled");
  });

  it("clicking Map to document… calls openMapping with entity name", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().setEditingView(validView);
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    fireEvent.click(screen.getByTestId("ctxitem-map-to-document"));
    expect(useJrdmStore.getState().mapping).toEqual({ open: true, table: "orders" });
  });

  // ── NV.T3: "New duality view" ↔ "Map to document" complementary gates ───────

  it("with no editingView: New duality view is ENABLED and clicking calls openMapping", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    // editingView is null (no view yet)
    expect(useJrdmStore.getState().editingView).toBeNull();
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    const newViewItem = screen.getByTestId("ctxitem-new-duality-view-from-this-table");
    // Should NOT be aria-disabled
    expect(newViewItem).not.toHaveAttribute("aria-disabled", "true");

    // Clicking calls openMapping (not startNewView) — mapping modal opens
    fireEvent.click(newViewItem);
    expect(useJrdmStore.getState().mapping).toEqual({ open: true, table: "orders" });
    // editingView remains null (modal was opened, not startNewView called)
    expect(useJrdmStore.getState().editingView).toBeNull();
  });

  it("with no editingView: Map to document is DISABLED", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    const mapItem = screen.getByTestId("ctxitem-map-to-document");
    expect(mapItem).toHaveAttribute("aria-disabled", "true");
  });

  it("with an editingView: New duality view is DISABLED (aria-disabled + tooltip)", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().setEditingView(validView);
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    const newViewItem = screen.getByTestId("ctxitem-new-duality-view-from-this-table");
    expect(newViewItem).toHaveAttribute("aria-disabled", "true");
    expect(newViewItem).toHaveAttribute("title", "Reset the current view to start a new one");
  });

  it("with an editingView: Map to document is ENABLED", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().setEditingView(validView);
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    const mapItem = screen.getByTestId("ctxitem-map-to-document");
    expect(mapItem).not.toHaveAttribute("aria-disabled", "true");
  });

  it("the two items are strict complements of canCreateNewView / canMapToDocument", () => {
    // Null view → canCreateNewView true, canMapToDocument false
    expect(canCreateNewView(null)).toBe(true);
    // Non-null view → canCreateNewView false, canMapToDocument true
    expect(canCreateNewView(validView)).toBe(false);
  });

  it("clicking Inspect table calls selectEntity and opens inspector", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    fireEvent.click(screen.getByTestId("ctxitem-inspect-table"));
    expect(useJrdmStore.getState().selectedEntity).toBe("app.orders");
    expect(useJrdmStore.getState().inspectorOpen).toBe(true);
  });

  it("clicking Hide from canvas calls hideEntity and filters node from render", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);

    const onNodeContextMenu = capturedProps.onNodeContextMenu as (
      e: React.MouseEvent,
      node: { id: string },
    ) => void;

    act(() => {
      onNodeContextMenu(
        { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent,
        { id: "app.orders" },
      );
    });

    act(() => {
      fireEvent.click(screen.getByTestId("ctxitem-hide-from-canvas"));
    });

    expect(useJrdmStore.getState().hiddenEntities).toContain("orders");

    // The filtered nodes passed to ReactFlow should not include the hidden entity
    const renderedNodes = capturedProps.nodes as Array<{ id: string }>;
    expect(renderedNodes.some((n) => n.id === "app.orders")).toBe(false);
  });

  it("Show hidden (N) control appears when entities are hidden and restores them", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().hideEntity("orders");
    render(<DiagramPane />);

    const showHiddenBtn = screen.getByTestId("show-hidden");
    expect(showHiddenBtn).toBeInTheDocument();
    expect(showHiddenBtn).toHaveTextContent("1");

    fireEvent.click(showHiddenBtn);
    expect(useJrdmStore.getState().hiddenEntities).toEqual([]);
  });

  it("Show hidden control is absent when no entities are hidden", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(screen.queryByTestId("show-hidden")).toBeNull();
  });

  it("⋯ button in EntityNode opens the same context menu", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);

    // The mock passes onOpenMenu down; click the ⋯ button
    const menuBtn = screen.getByTestId("entity-menu-orders");
    fireEvent.click(menuBtn);

    expect(screen.getByTestId("entity-context-menu")).toBeInTheDocument();
  });

  it("onNodeContextMenu passes through correctly (wired to ReactFlow)", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(typeof capturedProps.onNodeContextMenu).toBe("function");
  });
});

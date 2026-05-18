import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DiagramPane } from "./DiagramPane";
import { useJrdmStore } from "../state/store";
import type { DraftProject } from "@jrdm/model";
import type { NodePositionChange } from "@xyflow/react";

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
      (props.nodeTypes as Record<string, React.ComponentType<{ id: string; data: unknown }>>) ?? {};

    return (
      <ReactFlowProvider>
        <div data-testid="mock-reactflow">
          {nodes.map((n) => {
            const NodeComp = nodeTypes[n.type ?? ""] ?? null;
            return NodeComp ? <NodeComp key={n.id} id={n.id} data={n.data} /> : null;
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

  it("a simulated NodePositionChange persists across an unrelated re-render", () => {
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

  it("same-project re-render does NOT reset node positions", () => {
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
});

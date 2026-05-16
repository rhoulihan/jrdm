import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { RelationshipEdge } from "./RelationshipEdge";
import { tokens } from "../theme/tokens";

/**
 * We render RelationshipEdge via edgeTypes inside <ReactFlow> so that the
 * ReactFlow store is initialised (domNode is set, .react-flow__edgelabel-renderer
 * div is present in the DOM) before the edge component is mounted.
 *
 * React Flow only invokes custom edge components when both source/target nodes
 * exist, so we also inject a tiny <RelationshipEdge> directly (inside an SVG
 * sibling) with explicit coordinate props. This matches the EntityNode test
 * pattern (direct render with required props) while keeping the ReactFlowProvider
 * context alive so EdgeLabelRenderer can find its portal target.
 *
 * Additional EdgeProps fields required vs. what TypeScript strictly requires:
 *   selectable, deletable, animated — added to satisfy EdgeProps (same pattern
 *   as Task 11's draggable/selectable/deletable addition for NodeProps).
 */
function renderEdge(cardinality: "1:1" | "1:N") {
  return render(
    <ReactFlowProvider>
      {/* Initialise the store + create .react-flow__edgelabel-renderer in DOM */}
      <ReactFlow nodes={[]} edges={[]} style={{ width: 800, height: 600 }} />
      {/* Render the edge component directly so EdgeLabelRenderer has a portal target */}
      <svg>
        <RelationshipEdge
          id="e1"
          source="a"
          target="b"
          sourceX={0}
          sourceY={0}
          targetX={200}
          targetY={0}
          sourcePosition={Position.Right}
          targetPosition={Position.Left}
          data={{ cardinality }}
          selected={false}
          animated={false}
          selectable={false}
          deletable={false}
        />
      </svg>
    </ReactFlowProvider>,
  );
}

describe("RelationshipEdge", () => {
  it("renders the cardinality label 1:N", () => {
    renderEdge("1:N");
    expect(screen.getByText("1:N")).toBeInTheDocument();
  });

  it("renders the cardinality label 1:1", () => {
    renderEdge("1:1");
    expect(screen.getByText("1:1")).toBeInTheDocument();
  });

  it("token colors differ per cardinality", () => {
    expect(tokens.edge["1:1"]).not.toBe(tokens.edge["1:N"]);
  });
});

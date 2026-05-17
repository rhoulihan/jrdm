import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { EntityNode } from "./EntityNode";
import { useJrdmStore } from "../state/store";
import type { DraftEntity } from "@jrdm/model";

const entity: DraftEntity = {
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
};

function renderNode() {
  return render(
    <ReactFlowProvider>
      <EntityNode
        id="app.orders"
        data={{ entity }}
        selected={false}
        type="entity"
        dragging={false}
        draggable={false}
        selectable={false}
        deletable={false}
        zIndex={0}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  );
}

describe("EntityNode", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("renders the table name and all columns", () => {
    renderNode();
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.getByText("order_id")).toBeInTheDocument();
    expect(screen.getByText("customer_id")).toBeInTheDocument();
  });

  it("marks the PK column and the FK column", () => {
    renderNode();
    expect(screen.getByTestId("col-order_id")).toHaveTextContent("PK");
    expect(screen.getByTestId("col-customer_id")).toHaveTextContent("FK");
  });

  it("selects the entity in the store when clicked", async () => {
    renderNode();
    await userEvent.click(screen.getByText("orders"));
    expect(useJrdmStore.getState().selectedEntity).toBe("app.orders");
  });

  it("column <li> elements are draggable", () => {
    renderNode();
    expect(screen.getByTestId("col-order_id")).toHaveAttribute("draggable");
  });
});

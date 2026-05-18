import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { EntityNode, ENTITY_DRAG_MIME } from "./EntityNode";
import { DRAG_MIME } from "../document/dropTarget";
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

  it("entity header is draggable and sets application/x-jrdm-entity payload (table name)", () => {
    renderNode();
    const header = screen.getByTestId("entity-header-orders");
    expect(header).toHaveAttribute("draggable");
    // Simulate dragStart and capture what the dataTransfer received
    const setData = vi.fn();
    fireEvent.dragStart(header, {
      dataTransfer: { setData, effectAllowed: "copy" },
    });
    expect(setData).toHaveBeenCalledWith(ENTITY_DRAG_MIME, "orders");
    // Column MIME must NOT have been set during the entity header drag
    const columnCall = setData.mock.calls.find(([mime]) => mime === DRAG_MIME);
    expect(columnCall).toBeUndefined();
  });

  it("column dragStart sets application/x-jrdm-column payload, not entity MIME", () => {
    renderNode();
    const col = screen.getByTestId("col-order_id");
    const setData = vi.fn();
    fireEvent.dragStart(col, {
      dataTransfer: { setData, effectAllowed: "copy" },
    });
    // Must set column MIME with column name
    expect(setData).toHaveBeenCalledWith(
      DRAG_MIME,
      JSON.stringify({ table: "orders", column: "order_id" }),
    );
    // Must NOT set entity MIME
    const entityCall = setData.mock.calls.find(([mime]) => mime === ENTITY_DRAG_MIME);
    expect(entityCall).toBeUndefined();
  });
});

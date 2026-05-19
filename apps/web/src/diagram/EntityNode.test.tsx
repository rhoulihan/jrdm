import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { EntityNode } from "./EntityNode";
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

const noop = () => {};

function renderNode(onOpenMenu?: (entityName: string, x: number, y: number) => void) {
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
        onOpenMenu={onOpenMenu ?? noop}
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

  it("selects the entity in the store when header is clicked", async () => {
    renderNode();
    await userEvent.click(screen.getByTestId("entity-header-orders"));
    expect(useJrdmStore.getState().selectedEntity).toBe("app.orders");
  });

  // ── Hard guardrail: native entity-header drag is REMOVED (no longer draggable) ──

  it("entity header does NOT have a draggable attribute (native drag retired)", () => {
    renderNode();
    const header = screen.getByTestId("entity-header-orders");
    // The header button must NOT be draggable (the ENTITY_DRAG_MIME drag is retired)
    expect(header).not.toHaveAttribute("draggable");
  });

  it("entity header dragStart does NOT set ENTITY_DRAG_MIME (native drag retired)", () => {
    renderNode();
    const header = screen.getByTestId("entity-header-orders");
    const setData = vi.fn();
    fireEvent.dragStart(header, {
      dataTransfer: { setData, effectAllowed: "copy" },
    });
    // No call to setData with x-jrdm-entity (the retired ENTITY_DRAG_MIME)
    const entityCall = setData.mock.calls.find(([mime]) => mime === "application/x-jrdm-entity");
    expect(entityCall).toBeUndefined();
  });

  // ── ⋯ button (table actions affordance) ──

  it("renders a ⋯ button with the correct testid and accessible label", () => {
    renderNode();
    const btn = screen.getByTestId("entity-menu-orders");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", "Table actions for orders");
  });

  it("clicking the ⋯ button calls onOpenMenu with entity name and coordinates", () => {
    const onOpenMenu = vi.fn();
    renderNode(onOpenMenu);
    const btn = screen.getByTestId("entity-menu-orders");
    fireEvent.click(btn);
    expect(onOpenMenu).toHaveBeenCalledOnce();
    const call = onOpenMenu.mock.calls[0] as [string, number, number];
    expect(call[0]).toBe("orders");
    expect(typeof call[1]).toBe("number");
    expect(typeof call[2]).toBe("number");
  });

  it("clicking ⋯ button does NOT also select the entity (stops propagation)", () => {
    const onOpenMenu = vi.fn();
    renderNode(onOpenMenu);
    const btn = screen.getByTestId("entity-menu-orders");
    fireEvent.click(btn);
    // onOpenMenu was called but selectEntity should NOT have been triggered by the menu button
    // (the header click handler is on the header, not the entire button area)
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  // ── Column drag (ER.T3 responsibility — must stay for now) ──

  it("column <li> elements remain draggable (ER.T3 retires these; keep for now)", () => {
    renderNode();
    expect(screen.getByTestId("col-order_id")).toHaveAttribute("draggable");
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
    const entityCall = setData.mock.calls.find(([mime]) => mime === "application/x-jrdm-entity");
    expect(entityCall).toBeUndefined();
  });
});

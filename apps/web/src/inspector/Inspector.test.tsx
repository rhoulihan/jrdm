import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Inspector } from "./Inspector";
import { useJrdmStore } from "../state/store";
import type { DraftProject } from "@jrdm/model";

const project: DraftProject = {
  name: "p",
  version: "0.1.0",
  entities: [
    {
      name: "orders",
      schema: "app",
      columns: [
        { name: "order_id", type: "NUMBER", nullable: false },
        { name: "note", type: "VARCHAR2", nullable: true, length: 200 },
      ],
      primaryKey: ["order_id"],
      foreignKeys: [
        {
          name: "fk_o_c",
          columns: ["customer_id"],
          references: { schema: "app", table: "customers", columns: ["customer_id"] },
        },
      ],
    },
  ],
  views: [],
};

describe("Inspector", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("shows an empty hint when nothing is selected", () => {
    render(<Inspector />);
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });

  it("shows the selected entity's columns, PK, and FK", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().selectEntity("app.orders");
    render(<Inspector />);
    expect(screen.getByText("app.orders")).toBeInTheDocument();
    const columnsTable = screen.getByRole("table");
    expect(within(columnsTable).getByText("order_id")).toBeInTheDocument();
    expect(within(columnsTable).getByText(/NUMBER/)).toBeInTheDocument();
    expect(screen.getByTestId("inspector-pk")).toHaveTextContent("order_id");
    expect(screen.getByTestId("inspector-fk")).toHaveTextContent("fk_o_c");
  });

  it("shows a not-found hint if the selection no longer exists", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    useJrdmStore.getState().selectEntity("app.ghost");
    render(<Inspector />);
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });
});

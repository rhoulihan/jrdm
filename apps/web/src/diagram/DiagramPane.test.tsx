import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiagramPane } from "./DiagramPane";
import { useJrdmStore } from "../state/store";
import type { DraftProject } from "@jrdm/model";

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

describe("DiagramPane", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("shows an empty-state hint when there is no project", () => {
    render(<DiagramPane />);
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
  });

  it("renders the React Flow canvas when a project is loaded", () => {
    useJrdmStore.getState().setImport({ project, relationships: [], issues: [] });
    render(<DiagramPane />);
    expect(screen.getByTestId("diagram-canvas")).toBeInTheDocument();
  });
});

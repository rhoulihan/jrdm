import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssuesPanel } from "./IssuesPanel";
import { useJrdmStore } from "../state/store";

describe("IssuesPanel", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("shows a clean state when there are no issues", () => {
    render(<IssuesPanel />);
    expect(screen.getByTestId("issues-clean")).toBeInTheDocument();
  });

  it("lists issues with code and message", () => {
    useJrdmStore.getState().setImport({
      project: { name: "p", version: "0.1.0", entities: [], views: [] },
      relationships: [],
      issues: [
        {
          code: "UNMAPPED_TYPE",
          severity: "warning",
          message: "Column geo.shape has Oracle type SDO_GEOMETRY; defaulted to VARCHAR2",
          path: ["entities", "geo", "columns", "shape"],
        },
        {
          code: "PK_REQUIRED",
          severity: "error",
          message: "Entity logs has no primary key",
          path: ["entities", "logs"],
        },
      ],
    });
    render(<IssuesPanel />);
    expect(screen.getByText(/UNMAPPED_TYPE/)).toBeInTheDocument();
    expect(screen.getByText(/SDO_GEOMETRY/)).toBeInTheDocument();
    expect(screen.getByText(/PK_REQUIRED/)).toBeInTheDocument();
  });

  it("clicking an entity-scoped issue selects that entity", async () => {
    useJrdmStore.getState().setImport({
      project: {
        name: "p",
        version: "0.1.0",
        entities: [
          {
            name: "logs",
            schema: "app",
            columns: [{ name: "id", type: "NUMBER", nullable: false }],
            primaryKey: ["id"],
          },
        ],
        views: [],
      },
      relationships: [],
      issues: [
        { code: "PK_REQUIRED", severity: "error", message: "no pk", path: ["entities", "logs"] },
      ],
    });
    render(<IssuesPanel />);
    await userEvent.click(screen.getByText(/PK_REQUIRED/));
    expect(useJrdmStore.getState().selectedEntity).toBe("app.logs");
  });

  it("does NOT select a phantom entity when the issue path entity is not in the project", async () => {
    useJrdmStore.getState().reset();
    useJrdmStore.getState().setImport({
      project: { name: "p", version: "0.1.0", entities: [], views: [] },
      relationships: [],
      issues: [
        { code: "PK_REQUIRED", severity: "error", message: "no pk", path: ["entities", "ghost"] },
      ],
    });
    render(<IssuesPanel />);
    await userEvent.click(screen.getByText(/PK_REQUIRED/));
    expect(useJrdmStore.getState().selectedEntity).toBeNull();
  });

  it("selects the entity with its real schema when found", async () => {
    useJrdmStore.getState().reset();
    useJrdmStore.getState().setImport({
      project: {
        name: "p",
        version: "0.1.0",
        entities: [
          {
            name: "logs",
            schema: "hr",
            columns: [{ name: "id", type: "NUMBER", nullable: false }],
            primaryKey: ["id"],
          },
        ],
        views: [],
      },
      relationships: [],
      issues: [{ code: "X", severity: "warning", message: "m", path: ["entities", "logs"] }],
    });
    render(<IssuesPanel />);
    await userEvent.click(screen.getByText(/^X$/));
    expect(useJrdmStore.getState().selectedEntity).toBe("hr.logs");
  });
});

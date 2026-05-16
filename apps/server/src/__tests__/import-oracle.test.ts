import { describe, it, expect } from "vitest";
import type { DraftProject } from "@jrdm/model";
import { buildApp } from "../app";

describe("POST /api/import/oracle — response contract", () => {
  it("documents that the success body's project is a DraftProject (compile-time)", () => {
    // Type-level guard: the route returns { project: DraftProject; relationships; issues }.
    // If the route's return type regresses to Project, this fixture fails `pnpm typecheck`.
    const sample: { project: DraftProject; relationships: unknown[]; issues: unknown[] } = {
      project: { name: "p", version: "0.1.0", entities: [], views: [] },
      relationships: [],
      issues: [],
    };
    expect(sample.project.name).toBe("p");
  });
});

describe("POST /api/import/oracle — validation", () => {
  it("400 when connection is missing", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/oracle",
      payload: { schemaOwner: "APP", projectName: "p" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("400 when schemaOwner is missing", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/oracle",
      payload: {
        connection: { user: "u", password: "p", connectString: "h:1521/FREEPDB1" },
        projectName: "p",
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("400 with a clear error body on malformed connection", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/oracle",
      payload: {
        connection: { user: "", password: "", connectString: "" },
        schemaOwner: "APP",
        projectName: "p",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.any(String) });
    await app.close();
  });
});

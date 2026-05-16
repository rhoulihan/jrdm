import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

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

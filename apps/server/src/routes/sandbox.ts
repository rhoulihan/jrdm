// @tested-by: apps/server/src/__tests__/sandbox.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  openOracleConnection,
  openQueryConnection,
  sandboxSchemaName,
  createSandbox,
  dropSandbox,
} from "@jrdm/exec";

const ConnectionSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
  connectString: z.string().min(1),
});

export const sandboxRoute: FastifyPluginAsync = async (app) => {
  // POST /api/sandbox — create a per-project sandbox schema
  // Body: { connection (admin), projectId, password }
  app.post("/sandbox", async (req, reply) => {
    const body = req.body as {
      connection?: unknown;
      projectId?: unknown;
      password?: unknown;
    };

    // Validate admin connection params
    const parsedConn = ConnectionSchema.safeParse(body?.connection);
    if (!parsedConn.success) {
      return reply
        .code(400)
        .send({ error: "invalid_connection", details: parsedConn.error.format() });
    }
    const connParams = parsedConn.data;

    // Validate projectId — required non-empty string
    if (!body?.projectId || typeof body.projectId !== "string" || body.projectId.trim() === "") {
      return reply.code(400).send({ error: "invalid_body", message: "projectId is required" });
    }

    // Validate password — required non-empty string
    if (!body?.password || typeof body.password !== "string" || body.password.trim() === "") {
      return reply.code(400).send({ error: "invalid_body", message: "password is required" });
    }

    const name = sandboxSchemaName(body.projectId);

    // Open a WRITE Connection (openOracleConnection) for createSandbox — always close in finally
    const admin = await openOracleConnection(connParams);
    try {
      await createSandbox(admin, name, body.password);
      return { created: true, schema: name };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: "sandbox_create_failed", message });
    } finally {
      await admin.close();
    }
  });

  // DELETE /api/sandbox — tear down a per-project sandbox schema (idempotent)
  // Body: { connection (admin), projectId }
  app.delete("/sandbox", async (req, reply) => {
    const body = req.body as {
      connection?: unknown;
      projectId?: unknown;
    };

    // Validate admin connection params
    const parsedConn = ConnectionSchema.safeParse(body?.connection);
    if (!parsedConn.success) {
      return reply
        .code(400)
        .send({ error: "invalid_connection", details: parsedConn.error.format() });
    }
    const connParams = parsedConn.data;

    // Validate projectId — required non-empty string
    if (!body?.projectId || typeof body.projectId !== "string" || body.projectId.trim() === "") {
      return reply.code(400).send({ error: "invalid_body", message: "projectId is required" });
    }

    const name = sandboxSchemaName(body.projectId);

    // Open a QueryConnection (openQueryConnection) for dropSandbox — always close in finally
    // dropSandbox is idempotent: swallows ORA-01918 internally; a second call also resolves.
    const qc = await openQueryConnection(connParams);
    try {
      await dropSandbox(qc, name);
      return { dropped: true, schema: name };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: "sandbox_drop_failed", message });
    } finally {
      await qc.close();
    }
  });
};

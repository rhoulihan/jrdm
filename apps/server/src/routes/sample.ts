// @tested-by: apps/server/src/__tests__/sample.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DualityViewSchema } from "@jrdm/model";
import { emitSqlJson, UnsupportedFieldError, MissingLinkError } from "@jrdm/generator-duality";
import { openQueryConnection, sampleDocuments } from "@jrdm/exec";

const ConnectionSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
  connectString: z.string().min(1),
});

export const sampleRoute: FastifyPluginAsync = async (app) => {
  app.post("/sample", async (req, reply) => {
    const body = req.body as {
      view?: unknown;
      connection?: unknown;
      limit?: unknown;
    };

    // Validate view
    const parsedView = DualityViewSchema.safeParse(body?.view);
    if (!parsedView.success) {
      return reply.code(400).send({ error: "invalid_view", details: parsedView.error.format() });
    }
    const view = parsedView.data;

    // Call emitSqlJson to surface the same 422 contract as /api/deploy
    // (even though we don't need the SQL for sampling — uniform error contract)
    try {
      emitSqlJson(view);
    } catch (e) {
      if (e instanceof UnsupportedFieldError || e instanceof MissingLinkError) {
        return reply.code(422).send({ error: "unsupported_view", message: e.message });
      }
      throw e;
    }

    // Validate connection params
    const parsedConn = ConnectionSchema.safeParse(body?.connection);
    if (!parsedConn.success) {
      return reply
        .code(400)
        .send({ error: "invalid_connection", details: parsedConn.error.format() });
    }
    const connParams = parsedConn.data;

    // Parse optional limit
    const limit = typeof body?.limit === "number" ? body.limit : 5;

    // Open query connection and sample — always close in finally (no leak)
    const qc = await openQueryConnection(connParams);
    try {
      const documents = await sampleDocuments(qc, view.schema, view.name, limit);
      return { documents };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: "sample_failed", message });
    } finally {
      await qc.close();
    }
  });
};

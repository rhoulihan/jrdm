// @tested-by: apps/server/src/__tests__/document.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DualityViewSchema } from "@jrdm/model";
import { emitSqlJson, UnsupportedFieldError, MissingLinkError } from "@jrdm/generator-duality";
import { openQueryConnection, readDocument, writeDocument, isEtagConflict } from "@jrdm/exec";

const ConnectionSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
  connectString: z.string().min(1),
});

export const documentRoute: FastifyPluginAsync = async (app) => {
  // POST /api/document/read — fetch a single document by id
  app.post("/document/read", async (req, reply) => {
    const body = req.body as {
      view?: unknown;
      connection?: unknown;
      id?: unknown;
    };

    // Validate view
    const parsedView = DualityViewSchema.safeParse(body?.view);
    if (!parsedView.success) {
      return reply.code(400).send({ error: "invalid_view", details: parsedView.error.format() });
    }
    const view = parsedView.data;

    // Call emitSqlJson to surface the same 422 contract as /api/deploy
    // (even though we don't need the SQL — uniform unsupported_view contract)
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

    // Validate id — required, must be a string or number
    const id = body?.id;
    if (id === undefined || id === null || (typeof id !== "string" && typeof id !== "number")) {
      return reply.code(400).send({ error: "invalid_body", message: "id is required" });
    }

    // Open query connection and read — always close in finally (no leak)
    const qc = await openQueryConnection(connParams);
    try {
      const document = await readDocument(qc, view.schema, view.name, id);
      return { document };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: "document_read_failed", message });
    } finally {
      await qc.close();
    }
  });

  // POST /api/document/write — write a document back with ETag enforcement
  app.post("/document/write", async (req, reply) => {
    const body = req.body as {
      view?: unknown;
      connection?: unknown;
      id?: unknown;
      doc?: unknown;
    };

    // Validate view
    const parsedView = DualityViewSchema.safeParse(body?.view);
    if (!parsedView.success) {
      return reply.code(400).send({ error: "invalid_view", details: parsedView.error.format() });
    }
    const view = parsedView.data;

    // Call emitSqlJson to surface the same 422 contract as /api/deploy
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

    // Validate id and doc — both required
    const id = body?.id;
    if (id === undefined || id === null || (typeof id !== "string" && typeof id !== "number")) {
      return reply.code(400).send({ error: "invalid_body", message: "id is required" });
    }

    const doc = body?.doc;
    if (doc === undefined || doc === null || typeof doc !== "object" || Array.isArray(doc)) {
      return reply.code(400).send({ error: "invalid_body", message: "doc is required" });
    }

    // Open query connection and write — always close in finally (no leak)
    const qc = await openQueryConnection(connParams);
    try {
      await writeDocument(
        qc,
        view.schema,
        view.name,
        id,
        doc as Record<string, unknown> & { _metadata?: { etag?: string } },
      );
      // Re-read to return the fresh document with new etag
      const document = await readDocument(qc, view.schema, view.name, id);
      return { document };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isEtagConflict(e)) {
        return reply.code(409).send({ error: "etag_conflict", message });
      }
      return reply.code(502).send({ error: "document_write_failed", message });
    } finally {
      await qc.close();
    }
  });
};

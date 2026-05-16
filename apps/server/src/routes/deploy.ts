// @tested-by: apps/server/src/__tests__/deploy.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DualityViewSchema } from "@jrdm/model";
import { emitSqlJson, UnsupportedFieldError, MissingLinkError } from "@jrdm/generator-duality";
import { openOracleConnection, deployDdl } from "@jrdm/exec";

const ConnectionSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
  connectString: z.string().min(1),
});

export const deployRoute: FastifyPluginAsync = async (app) => {
  app.post("/deploy", async (req, reply) => {
    const body = req.body as {
      view?: unknown;
      connection?: unknown;
      preDdl?: unknown;
      dryRun?: unknown;
      sandboxSchema?: string;
    };

    // Validate view
    const parsedView = DualityViewSchema.safeParse(body?.view);
    if (!parsedView.success) {
      return reply.code(400).send({ error: "invalid_view", details: parsedView.error.format() });
    }
    const view = parsedView.data;

    // Generate SQL — may throw UnsupportedFieldError (C1) or MissingLinkError for nested fields
    let sql: string;
    try {
      sql = emitSqlJson(view);
    } catch (e) {
      if (e instanceof UnsupportedFieldError || e instanceof MissingLinkError) {
        return reply.code(422).send({ error: "unsupported_view", message: e.message });
      }
      throw e;
    }

    // dryRun escape — preserves behaviour for the web UI which has no Oracle
    if (body?.dryRun === true) {
      return { dryRun: true, sql };
    }

    // Validate connection params
    const parsedConn = ConnectionSchema.safeParse(body?.connection);
    if (!parsedConn.success) {
      return reply
        .code(400)
        .send({ error: "invalid_connection", details: parsedConn.error.format() });
    }
    const connParams = parsedConn.data;

    // Assemble statements: optional pre-DDL (table setup etc.) + the view DDL
    const preDdl: string[] = [];
    if (Array.isArray(body?.preDdl)) {
      for (const s of body.preDdl) {
        if (typeof s === "string") preDdl.push(s);
      }
    }
    const statements = [...preDdl, sql];

    // Open connection and deploy — always close in finally (no leak)
    const conn = await openOracleConnection(connParams);
    try {
      const result = await deployDdl(conn, statements);
      if (result.errors.length > 0) {
        return reply.code(502).send({ deployed: false, errors: result.errors });
      }
      return { deployed: true, statements: result.statements, view: view.name };
    } finally {
      await conn.close();
    }
  });
};

// @tested-by: apps/server/src/__tests__/schemas.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import oracledb from "oracledb";
import { listSchemas, type QueryExec } from "@jrdm/importer-oracle";

const BodySchema = z.object({
  connection: z.object({
    user: z.string().min(1),
    password: z.string().min(1),
    connectString: z.string().min(1),
  }),
});

export const schemasRoute: FastifyPluginAsync = async (app) => {
  app.post("/schemas", async (req, reply) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.format() });
    }
    const { connection } = parsed.data;

    let conn: oracledb.Connection | undefined;
    try {
      conn = await oracledb.getConnection(connection);
      const c = conn;
      const exec: QueryExec = async <T>(
        sql: string,
        binds?: Record<string, unknown>,
      ): Promise<T[]> => {
        const r = await c.execute<T>(sql, (binds ?? {}) as oracledb.BindParameters, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        return r.rows ?? [];
      };
      const schemas = await listSchemas(exec);
      return { schemas };
    } catch (e) {
      return reply
        .code(502)
        .send({ error: "schemas_failed", message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (conn) await conn.close();
    }
  });
};

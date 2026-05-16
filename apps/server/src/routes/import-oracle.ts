// @tested-by: apps/server/src/__tests__/import-oracle.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import oracledb from "oracledb";
import { importSchema, type QueryExec } from "@jrdm/importer-oracle";

const BodySchema = z.object({
  connection: z.object({
    user: z.string().min(1),
    password: z.string().min(1),
    connectString: z.string().min(1),
  }),
  schemaOwner: z.string().min(1),
  projectName: z.string().min(1),
  projectVersion: z.string().min(1).optional(),
});

export const importOracleRoute: FastifyPluginAsync = async (app) => {
  app.post("/import/oracle", async (req, reply) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.format() });
    }
    const { connection, schemaOwner, projectName, projectVersion } = parsed.data;

    let conn: oracledb.Connection | undefined;
    try {
      conn = await oracledb.getConnection(connection);
      const c = conn;
      const exec: QueryExec = async <T>(sql: string): Promise<T[]> => {
        const r = await c.execute<T>(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return r.rows ?? [];
      };
      const result = await importSchema(exec, {
        schemaOwner,
        projectName,
        ...(projectVersion !== undefined ? { projectVersion } : {}),
      });
      // project is a DraftProject (may have PK-less entities); see @jrdm/model DraftProjectSchema
      return {
        project: result.project,
        relationships: result.relationships,
        issues: result.issues,
      };
    } catch (e) {
      return reply
        .code(502)
        .send({ error: "import_failed", message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (conn) await conn.close();
    }
  });
};

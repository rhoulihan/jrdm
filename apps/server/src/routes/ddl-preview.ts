import type { FastifyPluginAsync } from "fastify";
import { DualityViewSchema } from "@jrdm/model";
import { emitSqlJson } from "@jrdm/generator-duality";

export const ddlPreviewRoute: FastifyPluginAsync = async (app) => {
  app.post("/ddl/preview", async (req, reply) => {
    const body = req.body as { view?: unknown };
    const parsed = DualityViewSchema.safeParse(body?.view);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid view", details: parsed.error.format() });
    }
    return { sql: emitSqlJson(parsed.data) };
  });
};

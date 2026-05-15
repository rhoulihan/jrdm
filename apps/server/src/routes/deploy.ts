import type { FastifyPluginAsync } from "fastify";
import { DualityViewSchema } from "@jrdm/model";
import { emitSqlJson } from "@jrdm/generator-duality";

export const deployRoute: FastifyPluginAsync = async (app) => {
  app.post("/deploy", async (req, reply) => {
    const body = req.body as { view?: unknown };
    const parsed = DualityViewSchema.safeParse(body?.view);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid view" });
    }
    const sql = emitSqlJson(parsed.data);
    return { dryRun: true, sql };
  });
};

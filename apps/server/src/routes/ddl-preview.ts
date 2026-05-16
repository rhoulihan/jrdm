// @tested-by: apps/server/src/__tests__/ddl-preview.test.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DualityViewSchema } from "@jrdm/model";
import {
  emitSqlJson,
  emitGraphql,
  MissingLinkError,
  UnsupportedFieldError,
} from "@jrdm/generator-duality";

const BodySchema = z.object({
  view: z.unknown(),
  syntax: z.enum(["sql", "graphql"]).optional(),
});

export const ddlPreviewRoute: FastifyPluginAsync = async (app) => {
  app.post("/ddl/preview", async (req, reply) => {
    const body = BodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid request", details: body.error.format() });
    }
    const parsed = DualityViewSchema.safeParse(body.data.view);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid view", details: parsed.error.format() });
    }
    try {
      if (body.data.syntax === "graphql") {
        return { graphql: emitGraphql(parsed.data) };
      }
      return { sql: emitSqlJson(parsed.data) };
    } catch (e) {
      if (e instanceof MissingLinkError || e instanceof UnsupportedFieldError) {
        return reply.code(422).send({ error: "unsupported_view", message: e.message });
      }
      throw e;
    }
  });
};

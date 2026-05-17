// @tested-by: apps/server/src/__tests__/import-oracle.test.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health";
import { ddlPreviewRoute } from "./routes/ddl-preview";
import { deployRoute } from "./routes/deploy";
import { importOracleRoute } from "./routes/import-oracle";
import { sampleRoute } from "./routes/sample";
import { documentRoute } from "./routes/document";

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(healthRoute, { prefix: "/api" });
  await app.register(ddlPreviewRoute, { prefix: "/api" });
  await app.register(deployRoute, { prefix: "/api" });
  await app.register(importOracleRoute, { prefix: "/api" });
  await app.register(sampleRoute, { prefix: "/api" });
  await app.register(documentRoute, { prefix: "/api" });
  return app;
}

// @tested-by: apps/server/src/__tests__/static-web.test.ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

export interface StaticWebOptions {
  /** Override the resolved dist directory (used in tests). Defaults to apps/web/dist. */
  distDir?: string;
}

/**
 * Serves the React SPA from apps/web/dist on the same origin as the API.
 *
 * - If dist is absent (dev/test without a web build), the plugin no-ops so
 *   all existing server tests remain green.
 * - API routes registered before this plugin always take precedence because
 *   Fastify matches explicit routes before the not-found handler.
 * - Non-/api GET requests that don't match a real asset fall back to index.html
 *   (SPA client-side routing support).
 */
export async function staticWebRoute(app: FastifyInstance, opts: StaticWebOptions) {
  const distDir = opts.distDir ?? fileURLToPath(new URL("../../../web/dist", import.meta.url));

  if (!existsSync(distDir)) {
    // No web dist present — no-op gracefully so unit/integration envs stay green.
    return;
  }

  await app.register(fastifyStatic, { root: distDir, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.method === "GET" && !request.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: "Not Found",
      statusCode: 404,
    });
  });
}

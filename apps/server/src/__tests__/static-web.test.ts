// covers: apps/server/src/routes/static-web.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../app";
import Fastify from "fastify";
import { staticWebRoute } from "../routes/static-web";

// ── fixture dist directory ────────────────────────────────────────────────────

let fixtureDir: string;

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "jrdm-static-web-test-"));
  // index.html with a marker
  writeFileSync(
    join(fixtureDir, "index.html"),
    "<!doctype html><html><body>JRDM_SPA_FIXTURE</body></html>",
  );
  // a real asset
  const assetsDir = join(fixtureDir, "assets");
  mkdirSync(assetsDir);
  writeFileSync(join(assetsDir, "app.js"), "console.log('fixture');");
});

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function makeAppWithDist() {
  const app = Fastify({ logger: false });
  await app.register(staticWebRoute, { distDir: fixtureDir });
  return app;
}

async function makeAppNoDist() {
  const app = Fastify({ logger: false });
  await app.register(staticWebRoute, {
    distDir: "/nonexistent/path/that/does/not/exist",
  });
  return app;
}

// ── dist PRESENT ──────────────────────────────────────────────────────────────

describe("staticWebRoute — dist present", () => {
  it("GET / returns 200 text/html with the fixture marker", async () => {
    const app = await makeAppWithDist();
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.body).toContain("JRDM_SPA_FIXTURE");
    await app.close();
  });

  it("GET /design (deep client route) falls back to index.html with 200", async () => {
    const app = await makeAppWithDist();
    const res = await app.inject({ method: "GET", url: "/design" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("JRDM_SPA_FIXTURE");
    await app.close();
  });

  it("GET /assets/app.js returns the real asset bytes", async () => {
    const app = await makeAppWithDist();
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("fixture");
    await app.close();
  });
});

// ── dist PRESENT + API routes coexist ─────────────────────────────────────────

describe("staticWebRoute — dist present + buildApp() API coexistence", () => {
  it("GET /api/health still returns 200 {status:ok}", async () => {
    // buildApp() uses the computed path (no dist in CI), so we build a minimal
    // app that wires the health route + static with the fixture dist.
    const { healthRoute } = await import("../routes/health");
    const app = Fastify({ logger: false });
    await app.register(healthRoute, { prefix: "/api" });
    await app.register(staticWebRoute, { distDir: fixtureDir });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
    await app.close();
  });

  it("GET /api/unknown returns JSON 404, not index.html", async () => {
    const app = await makeAppWithDist();
    const res = await app.inject({ method: "GET", url: "/api/unknown" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe("Not Found");
    expect(body.statusCode).toBe(404);
    // Must NOT be the SPA — not HTML
    expect(res.headers["content-type"]).not.toMatch(/text\/html/);
    await app.close();
  });

  it("POST /api/unknown returns JSON 404, not index.html", async () => {
    const app = await makeAppWithDist();
    const res = await app.inject({ method: "POST", url: "/api/unknown" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Not Found");
    await app.close();
  });
});

// ── dist ABSENT (graceful no-op) ──────────────────────────────────────────────

describe("staticWebRoute — dist absent (graceful no-op)", () => {
  it("buildApp() resolves without throwing when no dist exists", async () => {
    // Just verifying buildApp() doesn't throw when the real web dist may or may not exist.
    // The graceful no-op is proven by the no-dist app below.
    const app = await buildApp();
    // health check confirms the server is functional
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("GET /api/health still 200 when no dist", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("GET / returns JSON 404 when no dist (no SPA, server doesn't crash)", async () => {
    const app = await makeAppNoDist();
    const res = await app.inject({ method: "GET", url: "/" });
    // Without a dist the plugin is a no-op, Fastify returns its default 404
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

import { buildApp } from "./app";

const PORT = Number(process.env.PORT ?? 3737);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = await buildApp();
await app.listen({ port: PORT, host: HOST });
app.log.info(`JRDM listening on http://${HOST}:${PORT}`);

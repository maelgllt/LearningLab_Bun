import { app } from "./routes.ts";

const port = Number(process.env.PORT ?? 3000);
const isBun = typeof (globalThis as any).Bun !== "undefined";

if (isBun) {
  (globalThis as any).Bun.serve({ port, fetch: app.fetch });
  console.log(`[bun]  URL shortener à l'écoute sur http://localhost:${port}`);
} else {
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port });
  console.log(`[node] URL shortener à l'écoute sur http://localhost:${port}`);
}

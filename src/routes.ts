import { Hono } from "hono";
import { z } from "zod";
import { db } from "./db.ts";

export const app = new Hono();

const CreateLink = z.object({
  url: z.string().url(),
});

function detectRuntime(): string {
  if (typeof (globalThis as any).Bun !== "undefined") return "bun";
  if (typeof (globalThis as any).Deno !== "undefined") return "deno";
  return "node";
}

function genCode(len = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

app.get("/health", (c) => c.json({ status: "ok", runtime: detectRuntime() }));

// Création d'un lien court (routage + validation = conditions réelles)
app.post("/api/links", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CreateLink.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "URL invalide", details: parsed.error.flatten() }, 400);
  }
  const code = genCode();
  db.run(
    "INSERT INTO links (code, url, hits, created_at) VALUES (?, ?, 0, ?)",
    code,
    parsed.data.url,
    new Date().toISOString(),
  );
  return c.json({ code, url: parsed.data.url, shortUrl: `/${code}` }, 201);
});

// Liste des liens (lecture en base)
app.get("/api/links", (c) => {
  const rows = db.all<{ code: string; url: string; hits: number; created_at: string }>(
    "SELECT code, url, hits, created_at FROM links ORDER BY created_at DESC LIMIT 100",
  );
  return c.json({ count: rows.length, links: rows });
});

// Redirection (lecture + écriture en base à chaque appel)
app.get("/:code", (c) => {
  const code = c.req.param("code");
  const row = db.get<{ url: string }>("SELECT url FROM links WHERE code = ?", code);
  if (!row) return c.json({ error: "Lien introuvable" }, 404);
  db.run("UPDATE links SET hits = hits + 1 WHERE code = ?", code);
  return c.redirect(row.url, 302);
});

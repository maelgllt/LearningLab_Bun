import { test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/routes.ts";

test("POST /api/links rejette une URL invalide", async () => {
  const res = await app.request("/api/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "pas-une-url" }),
  });
  assert.equal(res.status, 400);
});

test("POST /api/links crée un lien, puis /:code redirige", async () => {
  const create = await app.request("/api/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  assert.equal(create.status, 201);
  const { code } = await create.json();
  assert.ok(code && code.length === 6);

  const redirect = await app.request(`/${code}`);
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "https://example.com");
});

test("GET /api/links renvoie la liste", async () => {
  const res = await app.request("/api/links");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.links));
});

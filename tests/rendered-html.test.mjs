import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + String(Date.now()));
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost" + pathname, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the NEXUS product foundation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>NEXUS — Play\. Think\. Evolve\.<\/title>/i);
  assert.match(html, /BOT ARENA/i);
  assert.match(html, /Five minds\. Five different problems\./i);
  assert.match(html, /Difficulty level/i);
  assert.match(html, /Board palette/i);
  assert.match(html, /Piece set/i);
  assert.match(html, /Play as/i);
  assert.match(html, /Bullet/i);
  assert.match(html, /promotion choice/i);
  assert.match(html, /exact draw reasons/i);
  assert.match(html, /PGN/i);
  assert.match(html, /Foundation map/i);
  assert.match(html, /Rules core/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("exposes a machine-readable health contract", async () => {
  const response = await render("/api/health");
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.status, "ok");
  assert.equal(health.capabilities.rules, "ready");
  assert.equal(health.capabilities.bots, "ready");
  assert.equal(health.capabilities.timeControls, "ready");
  assert.equal(health.capabilities.promotion, "ready");
  assert.equal(health.capabilities.drawRules, "ready");
});

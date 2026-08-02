import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);
const integrationTest = test;

async function render(pathname = "/") {
  if (!process.env.NEXUS_TEST_URL) {
    throw new Error("Run rendered integration tests through npm run test:render");
  }
  return fetch(new URL(pathname, process.env.NEXUS_TEST_URL));
}

integrationTest("server-renders the NEXUS product foundation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>NEXUS \u2014 Play\. Think\. Evolve\.<\/title>/i);
  assert.match(html, /BOT ARENA/i);
  assert.match(html, /Seven minds\. Seven different problems\./i);
  assert.match(html, /Difficulty level/i);
  assert.match(html, /Board palette/i);
  assert.match(html, /Piece set/i);
  assert.match(html, /Play as/i);
  assert.match(html, /Bullet/i);
  assert.match(html, /promotion choice/i);
  assert.match(html, /exact draw reasons/i);
  assert.match(html, /PGN/i);
  assert.match(html, /Stockfish 18 analysis/i);
  assert.match(html, /Play a real opponent/i);
  assert.match(html, /Enable ratings/i);
  assert.match(html, /Foundation map/i);
  assert.match(html, /Rules core/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

integrationTest("exposes a machine-readable health contract", async () => {
  const response = await render("/api/health");
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.status, "ok");
  assert.equal(health.capabilities.rules, "ready");
  assert.equal(health.capabilities.bots, "ready");
  assert.equal(health.capabilities.timeControls, "ready");
  assert.equal(health.capabilities.promotion, "ready");
  assert.equal(health.capabilities.drawRules, "ready");
  assert.equal(health.capabilities.multiplayer, "server-validated");
  assert.equal(health.capabilities.ratings, "elo-ready");
});

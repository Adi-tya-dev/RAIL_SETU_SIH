const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

async function get(path) {
  const res = await fetch(`${base}${path}`);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function post(path, payload) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

test("GET /api/integration/sources → 200 lists the four simulated sources", async () => {
  const { status, body } = await get("/api/integration/sources");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.mode, "SIMULATOR");
  assert.ok(body.data.disclaimer.includes("not live railway data"));
  const codes = body.data.sources.map((s) => s.code).sort();
  assert.deepStrictEqual(codes, ["COA", "SMMS", "TDMS", "TMS"]);
});

test("GET /api/integration/requests → 200 with per-source summary", async () => {
  const { status, body } = await get("/api/integration/requests");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data.requests));
  assert.ok(body.data.summary && typeof body.data.summary.total === "number");
  assert.ok(body.data.summary.bySource && typeof body.data.summary.bySource.TMS === "number");
});

test("GET /api/integration/requests filters by source", async () => {
  const { status, body } = await get("/api/integration/requests?source=TDMS&limit=100");
  assert.strictEqual(status, 200);
  assert.ok(body.data.requests.length > 0);
  assert.ok(body.data.requests.every((r) => r.source === "TDMS"));
});

test("GET /api/integration/requests rejects an unknown source", async () => {
  const { status, body } = await get("/api/integration/requests?source=NOPE");
  assert.strictEqual(status, 400);
  assert.strictEqual(body.success, false);
});

test("POST /api/integration/sync rejects an unknown source", async () => {
  const { status, body } = await post("/api/integration/sync", { sources: ["NOPE"] });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.success, false);
});

test("POST /api/integration/sync → 201 COMPLETED and upserts idempotently", async () => {
  const goodsBefore = await prisma.goodsTrainForecast.count({ where: { source: "COA" } });
  const { status, body } = await post("/api/integration/sync", { sources: ["TDMS"] });
  assert.strictEqual(status, 201);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.status, "COMPLETED");
  assert.strictEqual(body.data.summary.TDMS.status, "SUCCESS");
  assert.ok(body.data.summary.TDMS.imported + body.data.summary.TDMS.updated >= 7);

  // Re-run must not duplicate COA goods forecasts (unique external_ref upsert).
  const goodsAfter = await prisma.goodsTrainForecast.count({ where: { source: "COA" } });
  assert.strictEqual(goodsAfter, goodsBefore);
});

test("GET /api/integration/coa → 200 with blocks, timetable and goods", async () => {
  const { status, body } = await get("/api/integration/coa");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data.blocks));
  assert.ok(Array.isArray(body.data.timetable));
  assert.ok(Array.isArray(body.data.goods_forecast));
  assert.ok(body.data.blocks.length > 0);
  const g = body.data.goods_forecast.find((x) => x.external_ref === "GFA-001");
  assert.ok(g);
  assert.ok(g.planned_tonnes > 0);
  assert.ok(g.start_window && g.end_window);
});

test("GET /api/integration/sync/latest → 200 returns the most recent run", async () => {
  const { status, body } = await get("/api/integration/sync/latest");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(body.data && typeof body.data.status === "string");
});
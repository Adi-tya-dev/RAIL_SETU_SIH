const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

let server;
let base;
const createdPlanIds = [];

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (createdPlanIds.length > 0) {
    await prisma.blockPlan.deleteMany({
      where: { plan_id: { in: createdPlanIds.map((id) => BigInt(id)) } },
    });
  }
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

test("GET /api/health → 200", async () => {
  const { status, body } = await get("/api/health");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
});

test("GET /api/health/db → 200 when DB is running", async () => {
  const { status, body } = await get("/api/health/db");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
});

test("GET /api/maintenance → 200", async () => {
  const { status, body } = await get("/api/maintenance");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.pagination && body.pagination.total >= 0);
});

test("GET /api/maintenance/1 → 200", async () => {
  const { status, body } = await get("/api/maintenance/1");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
});

test("GET /api/blocks → 200", async () => {
  const { status, body } = await get("/api/blocks");
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(body.data));
});

test("GET /api/blocks/1 → 200 with nested section", async () => {
  const { status, body } = await get("/api/blocks/1");
  assert.strictEqual(status, 200);
  assert.ok(body.data.track && body.data.track.section);
});

test("GET /api/trains → 200", async () => {
  const { status, body } = await get("/api/trains");
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(body.data));
});

test("GET /api/assets → 200", async () => {
  const { status, body } = await get("/api/assets");
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(body.data));
});

test("GET /api/schedules → 200 even with no plans", async () => {
  const { status, body } = await get("/api/schedules");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.strictEqual(body.pagination.page, 1);
  assert.ok(body.pagination.total === 0);
  assert.strictEqual(body.pagination.totalPages, 0);
});

test("GET /api/dashboard/summary → 200 with all groups", async () => {
  const { status, body } = await get("/api/dashboard/summary");
  assert.strictEqual(status, 200);
  const data = body.data;
  for (const group of ["maintenance", "blocks", "trains", "assets", "plans"]) {
    assert.ok(data[group] && typeof data[group].total === "number", `missing ${group}.total`);
  }
});

test("Invalid query returns 400", async () => {
  const { status } = await get("/api/blocks?limit=0");
  assert.strictEqual(status, 400);
});

test("Invalid page returns 400", async () => {
  const { status, body } = await get("/api/trains?page=abc");
  assert.strictEqual(status, 400);
  assert.strictEqual(body.success, false);
});

test("Nonexistent schedule ID returns 404", async () => {
  const { status, body } = await get("/api/schedules/999999999");
  assert.strictEqual(status, 404);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.message, "Schedule not found");
});

test("Unknown route returns 404", async () => {
  const { status, body } = await get("/api/does-not-exist");
  assert.strictEqual(status, 404);
  assert.strictEqual(body.success, false);
});

test("BigInt IDs serialize to strings in block list", async () => {
  const { status, body } = await get("/api/blocks?limit=1");
  assert.strictEqual(status, 200);
  if (body.data.length > 0) {
    assert.strictEqual(typeof body.data[0].block_id, "string");
  }
});

test("POST /api/schedules/generate → 201 with a plan summary", async () => {
  const { status, body } = await post("/api/schedules/generate", {
    start: "2026-09-18T00:00:00.000Z",
    end: "2026-09-25T00:00:00.000Z",
  });
  assert.strictEqual(status, 201);
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data.mega_blocks));
  assert.ok(body.data.tasks_scheduled >= 1, "expected at least one scheduled task");
  assert.ok(body.data.plan_ids.length >= 1);
  assert.ok(typeof body.data.optimization_score === "number");
  createdPlanIds.push(...body.data.plan_ids);
  globalThis.__generatedPlan = body.data;
});

test("POST /api/schedules/generate validates the planning window", async () => {
  const { status } = await post("/api/schedules/generate", {
    start: "2026-09-25T00:00:00.000Z",
    end: "2026-09-18T00:00:00.000Z",
  });
  assert.strictEqual(status, 400);

  const missing = await post("/api/schedules/generate", {});
  assert.strictEqual(missing.status, 400);
});

test("POST /api/schedules/:id/simulate-delay → 200 with impact summary", async () => {
  const generated = globalThis.__generatedPlan;
  const planId = generated.plan_ids[0];
  const taskId = generated.scheduled_tasks[0].maintenance_task_id;

  const { status, body } = await post(`/api/schedules/${planId}/simulate-delay`, {
    task_id: taskId,
    extra_duration_minutes: 30,
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(body.data.new_end);
  assert.ok(typeof body.data.additional_delay_minutes === "number");
  assert.ok(Array.isArray(body.data.new_conflicts));
});

test("POST /api/schedules/:id/simulate-delay rejects an unknown task", async () => {
  const generated = globalThis.__generatedPlan;
  const planId = generated.plan_ids[0];
  const { status } = await post(`/api/schedules/${planId}/simulate-delay`, {
    task_id: "999999999",
    extra_duration_minutes: 30,
  });
  assert.strictEqual(status, 400);
});

test("POST /api/schedules/:id/simulate-delay returns 404 for missing plan", async () => {
  const { status } = await post("/api/schedules/999999999/simulate-delay", {
    task_id: "1",
    extra_duration_minutes: 30,
  });
  assert.strictEqual(status, 404);
});
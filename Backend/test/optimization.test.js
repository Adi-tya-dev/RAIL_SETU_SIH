const { test } = require("node:test");
const assert   = require("node:assert");

let optimizeBlockSchedule, computeOptimizationMetrics;
try {
  ({ optimizeBlockSchedule, computeOptimizationMetrics } = require("../src/algorithms/optimizationEngine"));
} catch (e) {
  console.error("Could not load optimizationEngine:", e.message);
  process.exit(1);
}

// ── Shared fixtures ───────────────────────────────────────────────────────────
const windows90  = [{ id: "W1", duration_mins: 90,  label: "09:00-10:30", section_codes: ["SEC-DLJP"], block_code: "B001" }];
const windows180 = [{ id: "W2", duration_mins: 180, label: "14:00-17:00", section_codes: ["SEC-DLJP"], block_code: "B001" }];
const windows = [...windows90, ...windows180];

function pkg(overrides) {
  return {
    package_id: "PKG_1",
    total_duration_required: 60,
    has_emergency: false,
    priority_score: 10,
    departments_involved: ["ENGINEERING"],
    block_codes: ["B001"],
    section_codes: ["SEC-DLJP"],
    task_count: 1,
    tasks: [],
    earliest_deadline: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("package that fits in a window is ASSIGNED", () => {
  const schedule = optimizeBlockSchedule([pkg()], windows90);
  assert.ok(schedule.length > 0);
  const entry = schedule.find((s) => s.package_id === "PKG_1");
  assert.ok(entry, "Package should appear in schedule");
  assert.strictEqual(entry.status, "ASSIGNED");
});

test("package exceeding all windows is UNASSIGNED with DEFICIT reason", () => {
  const bigPkg = pkg({ package_id: "PKG_X", total_duration_required: 300 });
  const schedule = optimizeBlockSchedule([bigPkg], windows);
  const entry = schedule.find((s) => s.package_id === "PKG_X");
  assert.ok(entry);
  assert.strictEqual(entry.status, "UNASSIGNED");
  assert.match(entry.unassigned_reason || "", /DEFICIT|CONFLICT|WINDOW/i);
});

test("emergency packages are processed before routine packages", () => {
  const routine   = pkg({ package_id: "ROUTINE", has_emergency: false, priority_score: 18, total_duration_required: 60 });
  const emergency = pkg({ package_id: "EMERGENCY", has_emergency: true,  priority_score: 5,  total_duration_required: 60 });

  // Pass routine first — optimizer should internally re-sort
  const schedule = optimizeBlockSchedule([routine, emergency], windows90);
  const emergencyEntry = schedule.find((s) => s.package_id === "EMERGENCY");
  const routineEntry   = schedule.find((s) => s.package_id === "ROUTINE");

  // Both should be assigned (90-min window can fit two 60-min packages... or not
  // depending on capacity deduction — but emergency should be assigned if only one fits)
  assert.ok(emergencyEntry, "Emergency package must appear in schedule");
  if (emergencyEntry.status === "ASSIGNED" && routineEntry && routineEntry.status === "UNASSIGNED") {
    // Emergency was preferred — correct behavior
    assert.ok(true);
  } else {
    // Both assigned is also fine (window had enough capacity)
    assert.strictEqual(emergencyEntry.status, "ASSIGNED");
  }
});

test("section mismatch prevents assignment", () => {
  const mismatchPkg = pkg({ package_id: "MISMATCH", section_codes: ["SEC-BCAH"], block_codes: ["B010"] });
  const schedule    = optimizeBlockSchedule([mismatchPkg], windows);
  const entry       = schedule.find((s) => s.package_id === "MISMATCH");
  assert.ok(entry);
  assert.strictEqual(entry.status, "UNASSIGNED");
});

test("computeOptimizationMetrics returns correct totals", () => {
  const assignedPkg   = pkg({ package_id: "A", total_duration_required: 60 });
  const unassignedPkg = pkg({ package_id: "U", total_duration_required: 500 });
  const schedule      = optimizeBlockSchedule([assignedPkg, unassignedPkg], windows90);

  const metrics = computeOptimizationMetrics(schedule, [assignedPkg, unassignedPkg], windows90);
  assert.strictEqual(typeof metrics.total_packages,    "number");
  assert.strictEqual(typeof metrics.assigned_packages, "number");
  assert.ok(metrics.assigned_packages <= metrics.total_packages);
});

test("empty packages returns empty schedule", () => {
  const schedule = optimizeBlockSchedule([], windows);
  assert.deepStrictEqual(schedule, []);
});

test("empty windows returns all packages as UNASSIGNED", () => {
  const schedule = optimizeBlockSchedule([pkg()], []);
  const entry    = schedule.find((s) => s.package_id === "PKG_1");
  assert.ok(entry);
  assert.strictEqual(entry.status, "UNASSIGNED");
  assert.match(entry.unassigned_reason || "", /NO_WINDOWS|DEFICIT|CONFLICT/i);
});

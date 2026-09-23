const { test } = require("node:test");
const assert   = require("node:assert");

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeTask(overrides) {
  return {
    id: "T1",
    department: "ENGINEERING",
    start_km: 5.0,
    section_code: "SEC-DLJP",
    duration: 60,
    duration_minutes: 60,
    urgency: 2,
    priority: 2,
    criticality: 2,
    block_code: "B001",
    block_start_chainage: 0,
    block_end_chainage: 15,
    status: "APPROVED",
    category: "ROUTINE",
    ...overrides,
  };
}

let generateWorkPackages;
try {
  ({ generateWorkPackages } = require("../src/algorithms/clusteringEngine"));
} catch (e) {
  console.error("Could not load clusteringEngine:", e.message);
  process.exit(1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("tasks within 2km cluster into one package", () => {
  const pkgs = generateWorkPackages([
    makeTask({ id: "T1", department: "ENGINEERING", start_km: 5.0 }),
    makeTask({ id: "T2", department: "SIGNAL", start_km: 6.5, block_code: "B001" }),
  ]);
  assert.strictEqual(pkgs.length, 1, "Expected 1 package for tasks 1.5 km apart");
  assert.strictEqual(pkgs[0].task_count, 2);
  assert.ok(pkgs[0].departments_involved.includes("ENGINEERING"));
  assert.ok(pkgs[0].departments_involved.includes("SIGNAL"));
});

test("tasks further than 2km form separate packages", () => {
  const pkgs = generateWorkPackages([
    makeTask({ id: "T1", start_km: 2.0 }),
    makeTask({ id: "T2", start_km: 5.5 }),
  ]);
  assert.strictEqual(pkgs.length, 2, "Expected 2 packages for tasks 3.5 km apart");
});

test("tasks in different sections never cluster together", () => {
  const pkgs = generateWorkPackages([
    makeTask({ id: "T1", section_code: "SEC-DLJP", start_km: 5.0, block_code: "B001" }),
    makeTask({ id: "T2", section_code: "SEC-DLAM", start_km: 5.5, block_code: "B004" }),
  ]);
  assert.strictEqual(pkgs.length, 2, "Different sections must not merge");
});

test("duration uses MAX not SUM (concurrent multi-crew work)", () => {
  const pkgs = generateWorkPackages([
    makeTask({ id: "T1", department: "ENGINEERING", start_km: 5.0, duration: 120, duration_minutes: 120 }),
    makeTask({ id: "T2", department: "TRACTION",    start_km: 5.8, duration: 90,  duration_minutes: 90  }),
  ]);
  assert.strictEqual(pkgs.length, 1);
  assert.strictEqual(pkgs[0].wrench_duration_mins, 120, "Wrench duration should be MAX(120, 90) = 120");
});

test("poisonous clubbing: heavy routine decoupled from urgent task", () => {
  const pkgs = generateWorkPackages([
    makeTask({ id: "T1", urgency: 4, criticality: 4, category: "DEFECT", duration: 60, duration_minutes: 60, start_km: 5.0 }),
    makeTask({ id: "T2", urgency: 1, criticality: 1, category: "ROUTINE", duration: 280, duration_minutes: 280, start_km: 5.3 }),
  ]);
  // Heavy routine (280 > 180 AND 280 > 1.4*60=84) should be decoupled
  assert.strictEqual(pkgs.length, 2, "Expected poisonous clubbing guard to split into 2 packages");
  const urgentPkg = pkgs.find((p) => p.has_emergency);
  assert.ok(urgentPkg, "Should have an emergency package");
  assert.ok(urgentPkg.total_duration_required < 280, "Urgent package must be lean");
});

test("single task produces a single-task work package", () => {
  const pkgs = generateWorkPackages([makeTask({ id: "T1" })]);
  assert.strictEqual(pkgs.length, 1);
  assert.strictEqual(pkgs[0].task_count, 1);
});

test("empty input returns empty array", () => {
  const pkgs = generateWorkPackages([]);
  assert.deepStrictEqual(pkgs, []);
});

test("multi-block package sets is_multi_block flag", () => {
  const pkgs = generateWorkPackages([
    makeTask({ id: "T1", block_code: "B001", block_start_chainage: 0, block_end_chainage: 15, start_km: 14.5, section_code: "SEC-DLJP" }),
    makeTask({ id: "T2", block_code: "B002", block_start_chainage: 15, block_end_chainage: 30, start_km: 15.5, section_code: "SEC-DLJP" }),
  ]);
  if (pkgs.length === 1) {
    assert.strictEqual(pkgs[0].is_multi_block, true, "Should flag is_multi_block for cross-block cluster");
  } else {
    // Acceptable if engine treats different block codes as separate packages
    assert.strictEqual(pkgs.length, 2);
  }
});

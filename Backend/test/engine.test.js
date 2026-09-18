const { test } = require("node:test");
const assert = require("node:assert");
const { generateSchedule } = require("../src/algorithms/scheduling.engine");
const { simulateWhatIf } = require("../src/algorithms/simulation.engine");

const WINDOW = {
  start: new Date("2026-09-18T00:00:00Z"),
  end: new Date("2026-09-25T00:00:00Z"),
};

function task(overrides) {
  return {
    maintenance_task_id: "1",
    block_id: "1",
    department: "ENGINEERING",
    maintenance_type: "Track Work",
    priority: 2,
    criticality: 2,
    urgency: 2,
    duration_minutes: 60,
    preferred_start: null,
    deadline: null,
    status: "PENDING",
    ...overrides,
  };
}

function block(overrides) {
  return {
    block_id: "1",
    block_code: "B001",
    status: "AVAILABLE",
    availability: true,
    ...overrides,
  };
}

function movement(overrides) {
  return {
    movement_id: "1",
    train_id: "9",
    block_id: "1",
    scheduled_entry: new Date("2026-09-15T11:00:00Z"),
    scheduled_exit: new Date("2026-09-15T11:15:00Z"),
    train: { train_number: "12301", priority: 1 },
    ...overrides,
  };
}

test("consolidates same-block tasks into a single mega block", () => {
  const output = generateSchedule({
    planning_window: WINDOW,
    blocks: [block()],
    maintenance_tasks: [
      task({ maintenance_task_id: "1", department: "ENGINEERING", duration_minutes: 120, priority: 4, criticality: 4, urgency: 4, preferred_start: new Date("2026-09-15T10:00:00Z"), deadline: new Date("2026-09-15T14:00:00Z") }),
      task({ maintenance_task_id: "2", department: "TRACTION", duration_minutes: 90, priority: 3, criticality: 3, urgency: 3, preferred_start: new Date("2026-09-15T10:30:00Z"), deadline: new Date("2026-09-15T14:00:00Z") }),
      task({ maintenance_task_id: "3", department: "SIGNAL", duration_minutes: 60, priority: 3, criticality: 4, urgency: 3, preferred_start: new Date("2026-09-15T10:00:00Z"), deadline: new Date("2026-09-15T13:00:00Z") }),
    ],
    train_movements: [],
  });

  assert.strictEqual(output.mega_blocks.length, 1);
  const megaBlock = output.mega_blocks[0];
  assert.strictEqual(megaBlock.task_count, 3);
  assert.deepStrictEqual([...megaBlock.departments].sort(), ["ENGINEERING", "SIGNAL", "TRACTION"]);
  assert.strictEqual(megaBlock.duration_minutes, 150);
  assert.strictEqual(megaBlock.planned_start.toISOString(), "2026-09-18T10:00:00.000Z");
  assert.strictEqual(output.metrics.tasks_scheduled, 3);
  assert.strictEqual(output.metrics.tasks_unscheduled, 0);
  assert.strictEqual(output.metrics.mega_block_count, 1);
});

test("flags train conflicts overlapping the mega block window", () => {
  const output = generateSchedule({
    planning_window: WINDOW,
    blocks: [block()],
    maintenance_tasks: [
      task({ maintenance_task_id: "1", duration_minutes: 120, preferred_start: new Date("2026-09-15T10:00:00Z") }),
    ],
    train_movements: [movement()],
  });

  assert.strictEqual(output.conflicts.length, 1);
  const conflict = output.conflicts[0];
  assert.strictEqual(conflict.conflict_type, "TRAIN_MAINTENANCE");
  assert.strictEqual(conflict.train_number, "12301");
  assert.strictEqual(conflict.severity, 4);
  assert.strictEqual(conflict.estimated_delay_minutes, 15);
  assert.strictEqual(output.metrics.affected_train_count, 1);
  assert.strictEqual(output.train_impacts.length, 1);
});

test("reports tasks on unavailable or missing blocks as unscheduled", () => {
  const output = generateSchedule({
    planning_window: WINDOW,
    blocks: [block({ block_id: "1" }), block({ block_id: "2", block_code: "B012", status: "UNDER_REPAIR", availability: false })],
    maintenance_tasks: [
      task({ maintenance_task_id: "1", block_id: "2" }),
      task({ maintenance_task_id: "2", block_id: null }),
      task({ maintenance_task_id: "3", block_id: "1" }),
      task({ maintenance_task_id: "4", block_id: "1", status: "COMPLETED" }),
    ],
    train_movements: [],
  });

  const reasons = output.unscheduled_tasks.map((entry) => entry.reason).sort();
  assert.deepStrictEqual(reasons, ["BLOCK_UNAVAILABLE", "NO_BLOCK"]);
  assert.strictEqual(output.metrics.tasks_scheduled, 1);
  assert.strictEqual(output.metrics.tasks_unscheduled, 2);
  assert.ok(!JSON.stringify(output).includes('"4"'));
});

test("drops tasks whose deadline cannot be met", () => {
  const output = generateSchedule({
    planning_window: WINDOW,
    blocks: [block()],
    maintenance_tasks: [
      task({ maintenance_task_id: "1", duration_minutes: 120, preferred_start: new Date("2026-09-15T10:00:00Z"), deadline: new Date("2026-09-15T10:30:00Z") }),
    ],
    train_movements: [],
  });

  assert.strictEqual(output.mega_blocks.length, 0);
  assert.strictEqual(output.unscheduled_tasks.length, 1);
  assert.strictEqual(output.unscheduled_tasks[0].reason, "DEADLINE_VIOLATION");
});

test("generateSchedule is deterministic for identical input", () => {
  const input = {
    planning_window: WINDOW,
    blocks: [block()],
    maintenance_tasks: [task({ maintenance_task_id: "1", preferred_start: new Date("2026-09-15T10:00:00Z") })],
    train_movements: [movement()],
  };
  assert.deepStrictEqual(generateSchedule(input), generateSchedule(input));
});

test("simulateWhatIf extends the plan window and reports new impacts", () => {
  const result = simulateWhatIf({
    plan: {
      plan_id: "1",
      block_id: "1",
      block_code: "B001",
      planned_start: new Date("2026-09-18T10:00:00Z"),
      planned_end: new Date("2026-09-18T12:30:00Z"),
    },
    tasks: [{ maintenance_task_id: "1" }],
    movements: [
      movement(),
      movement({
        movement_id: "2",
        train_id: "10",
        scheduled_entry: new Date("2026-09-15T12:50:00Z"),
        scheduled_exit: new Date("2026-09-15T13:05:00Z"),
        train: { train_number: "54311", priority: 4 },
      }),
    ],
    task_id: "1",
    extra_duration_minutes: 30,
  });

  assert.strictEqual(result.original_end.toISOString(), "2026-09-18T12:30:00.000Z");
  assert.strictEqual(result.new_end.toISOString(), "2026-09-18T13:00:00.000Z");
  assert.strictEqual(result.additional_delay_minutes, 15);
  assert.strictEqual(result.new_affected_trains_count, 2);
  assert.strictEqual(result.new_conflicts.length, 1);
  assert.strictEqual(result.new_conflicts[0].train_number, "54311");
  assert.strictEqual(result.updated_plan.planned_end.toISOString(), "2026-09-18T13:00:00.000Z");
});

test("simulateWhatIf rejects tasks that are not part of the plan", () => {
  assert.throws(
    () =>
      simulateWhatIf({
        plan: {
          plan_id: "1",
          block_id: "1",
          block_code: "B001",
          planned_start: new Date("2026-09-18T10:00:00Z"),
          planned_end: new Date("2026-09-18T12:30:00Z"),
        },
        tasks: [{ maintenance_task_id: "1" }],
        movements: [],
        task_id: "999",
        extra_duration_minutes: 30,
      }),
    /not part of this plan/
  );
});

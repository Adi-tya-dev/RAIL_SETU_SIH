const { addMinutes, round } = require("../utils/time.util");
const { detectTrainConflicts } = require("./conflict.util");

function toId(value) {
  return value === undefined || value === null ? null : String(value);
}

function conflictKey(conflict) {
  return `${toId(conflict.train_id)}|${conflict.conflict_type}`;
}

function simulateWhatIf(input) {
  const plan = input.plan || {};
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const movements = Array.isArray(input.movements) ? input.movements : [];
  const taskId = toId(input.task_id);
  const extra = Number(input.extra_duration_minutes);

  const plannedStart = new Date(plan.planned_start);
  const originalEnd = new Date(plan.planned_end);
  if (Number.isNaN(plannedStart.getTime()) || Number.isNaN(originalEnd.getTime())) {
    throw new Error("A plan with a valid planned_start and planned_end is required");
  }
  if (!Number.isFinite(extra) || extra <= 0) {
    throw new Error("extra_duration_minutes must be a positive number");
  }

  const task = tasks.find((entry) => toId(entry.maintenance_task_id) === taskId);
  if (!task) {
    throw new Error("Task is not part of this plan");
  }

  const newEnd = addMinutes(originalEnd, extra);
  const blockId = toId(plan.block_id);
  const blockCode = plan.block_code || (plan.block ? plan.block.block_code : null);

  const originalConflicts = detectTrainConflicts({
    movements,
    blockId,
    blockCode,
    windowStart: plannedStart,
    windowEnd: originalEnd,
    dayAnchor: plannedStart,
  });
  const newConflicts = detectTrainConflicts({
    movements,
    blockId,
    blockCode,
    windowStart: plannedStart,
    windowEnd: newEnd,
    dayAnchor: plannedStart,
  });

  const originalKeys = new Set(originalConflicts.map(conflictKey));
  const introduced = newConflicts.filter((conflict) => !originalKeys.has(conflictKey(conflict)));

  const originalDelay = originalConflicts.reduce((sum, conflict) => sum + conflict.estimated_delay_minutes, 0);
  const newDelay = newConflicts.reduce((sum, conflict) => sum + conflict.estimated_delay_minutes, 0);
  const additionalDelay = Math.max(0, round(newDelay - originalDelay, 2));
  const affectedTrainCount = new Set(newConflicts.map((conflict) => conflict.train_id)).size;

  return {
    plan_id: toId(plan.plan_id),
    task_id: taskId,
    block_id: blockId,
    block_code: blockCode,
    extra_duration_minutes: extra,
    original_end: originalEnd,
    new_end: newEnd,
    additional_delay_minutes: additionalDelay,
    new_affected_trains: newConflicts.map((conflict) => ({
      train_id: conflict.train_id,
      train_number: conflict.train_number,
      estimated_delay_minutes: conflict.estimated_delay_minutes,
    })),
    new_affected_trains_count: affectedTrainCount,
    new_conflicts: introduced,
    total_conflicts: newConflicts.length,
    updated_plan: {
      plan_id: toId(plan.plan_id),
      block_id: blockId,
      block_code: blockCode,
      planned_start: plannedStart,
      planned_end: newEnd,
      affected_train_count: affectedTrainCount,
      expected_delay_minutes: round(newDelay, 2),
    },
  };
}

module.exports = { simulateWhatIf };

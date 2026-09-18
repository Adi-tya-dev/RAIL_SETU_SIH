const {
  addMinutes,
  round,
  clamp,
  projectIntoWindow,
  projectIntoWindowAfter,
} = require("../utils/time.util");
const { detectTrainConflicts } = require("./conflict.util");

const CANDIDATE_STATUSES = ["PENDING", "APPROVED"];
const AVAILABLE_BLOCK_STATUS = "AVAILABLE";
const COORDINATION_BUFFER_MINUTES = 15;

function toId(value) {
  return value === undefined || value === null ? null : String(value);
}

function taskWeight(task) {
  return (task.priority || 1) * 3 + (task.criticality || 1) * 2 + (task.urgency || 1) * 2;
}

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const weigthDifference = taskWeight(b) - taskWeight(a);
    if (weigthDifference !== 0) return weigthDifference;
    const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (deadlineA !== deadlineB) return deadlineA - deadlineB;
    return (a.duration_minutes || 0) - (b.duration_minutes || 0);
  });
}

function compositeScore({ ratio, delay, scheduledDuration, conflictCount, scheduledCount }) {
  const delayPenalty = delay / (delay + scheduledDuration + 1);
  const conflictPenalty = conflictCount / (conflictCount + scheduledCount + 1);
  return clamp(0.5 * ratio + 0.3 * (1 - delayPenalty) + 0.2 * (1 - conflictPenalty), 0, 1);
}

function resolveStart(tasks, windowStart, windowEnd) {
  const preferred = tasks.filter((task) => task.preferred_start);
  if (preferred.length === 0) return new Date(windowStart.getTime());

  const earliest = preferred.reduce((min, task) => {
    const value = new Date(task.preferred_start);
    return value < min ? value : min;
  }, new Date(preferred[0].preferred_start));

  return projectIntoWindow(earliest, windowStart, windowEnd);
}

function earliestDeadlineLimit(tasks, anchor, windowStart, windowEnd) {
  const deadlines = tasks.filter((task) => task.deadline).map((task) => new Date(task.deadline));
  if (deadlines.length === 0) return null;
  const earliest = deadlines.reduce((min, date) => (date < min ? date : min), deadlines[0]);
  return projectIntoWindowAfter(earliest, windowStart, windowEnd, anchor);
}

function makeUnscheduled(task, block, reason) {
  return {
    maintenance_task_id: toId(task.maintenance_task_id),
    block_id: toId(task.block_id),
    block_code: block ? block.block_code : null,
    department: task.department,
    reason,
  };
}

function scheduleBlockGroup(block, groupTasks, context) {
  const { windowStart, windowEnd, windowMinutes, movements } = context;
  const unscheduled = [];
  let remaining = sortByPriority(groupTasks);
  let group = [];
  let plannedStart = null;
  let closureDuration = 0;

  while (remaining.length > 0) {
    const start = resolveStart(remaining, windowStart, windowEnd);
    const departmentCount = new Set(remaining.map((task) => task.department)).size;
    const maxDuration = Math.max(...remaining.map((task) => Number(task.duration_minutes)));
    const duration = Math.min(
      maxDuration + COORDINATION_BUFFER_MINUTES * Math.max(0, departmentCount - 1),
      windowMinutes
    );
    const projectedEnd = addMinutes(start, duration);
    const limit = earliestDeadlineLimit(remaining, start, windowStart, windowEnd);

    if (limit && projectedEnd > limit) {
      const dropped = remaining.filter((task) => {
        if (!task.deadline) return false;
        const ownLimit = projectIntoWindowAfter(new Date(task.deadline), windowStart, windowEnd, start);
        return projectedEnd > ownLimit;
      });

      if (dropped.length === 0) {
        group = remaining;
        plannedStart = start;
        closureDuration = duration;
        break;
      }

      const droppedIds = new Set(dropped.map((task) => toId(task.maintenance_task_id)));
      for (const task of dropped) unscheduled.push(makeUnscheduled(task, block, "DEADLINE_VIOLATION"));
      remaining = remaining.filter((task) => !droppedIds.has(toId(task.maintenance_task_id)));
      continue;
    }

    group = remaining;
    plannedStart = start;
    closureDuration = duration;
    break;
  }

  if (group.length === 0) return { unscheduled, megaBlock: null };

  const plannedEnd = addMinutes(plannedStart, closureDuration);
  const blockMovements = movements.filter((movement) => toId(movement.block_id) === toId(block.block_id));
  const conflicts = detectTrainConflicts({
    movements: blockMovements,
    blockId: toId(block.block_id),
    blockCode: block.block_code,
    windowStart: plannedStart,
    windowEnd: plannedEnd,
    dayAnchor: plannedStart,
  });

  const scheduledWeight = group.reduce((sum, task) => sum + taskWeight(task), 0);
  const delay = conflicts.reduce((sum, conflict) => sum + conflict.estimated_delay_minutes, 0);
  const departments = [...new Set(group.map((task) => task.department))];
  const affectedTrains = new Set(conflicts.map((conflict) => conflict.train_id)).size;

  const blockCandidateWeight = groupTasks.reduce((sum, task) => sum + taskWeight(task), 0);
  const ratio = blockCandidateWeight > 0 ? scheduledWeight / blockCandidateWeight : 0;
  const optimizationScore = compositeScore({
    ratio,
    delay,
    scheduledDuration: closureDuration,
    conflictCount: conflicts.length,
    scheduledCount: group.length,
  });

  const reason = [
    `Consolidated ${group.length} maintenance task${group.length === 1 ? "" : "s"} from ${
      departments.length
    } department${departments.length === 1 ? "" : "s"}`,
  ];
  if (conflicts.length > 0) {
    reason.push(`${conflicts.length} train conflict${conflicts.length === 1 ? "" : "s"} flagged for review`);
  }

  const megaBlock = {
    block_id: toId(block.block_id),
    block_code: block.block_code,
    planned_start: plannedStart,
    planned_end: plannedEnd,
    duration_minutes: closureDuration,
    task_ids: group.map((task) => toId(task.maintenance_task_id)),
    task_count: group.length,
    tasks: group.map((task) => ({
      maintenance_task_id: toId(task.maintenance_task_id),
      department: task.department,
      maintenance_type: task.maintenance_type,
      duration_minutes: Number(task.duration_minutes),
    })),
    departments,
    optimization_score: round(optimizationScore, 4),
    asset_availability_score: round(clamp(1 - closureDuration / windowMinutes, 0, 1), 4),
    affected_train_count: affectedTrains,
    estimated_delay_minutes: round(delay, 2),
    reason,
  };

  return { unscheduled, megaBlock, conflicts };
}

function generateSchedule(input) {
  const windowStart = new Date(input && input.planning_window ? input.planning_window.start : NaN);
  const windowEnd = new Date(input && input.planning_window ? input.planning_window.end : NaN);
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    throw new Error("A planning_window with a valid start and end is required");
  }

  const windowMinutes = Math.max(1, (windowEnd.getTime() - windowStart.getTime()) / 60000);
  const tasks = Array.isArray(input.maintenance_tasks) ? input.maintenance_tasks : [];
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const movements = Array.isArray(input.train_movements) ? input.train_movements : [];
  const blockById = new Map(blocks.map((block) => [toId(block.block_id), block]));

  const candidates = [];
  const unscheduled = [];

  for (const task of tasks) {
    if (!CANDIDATE_STATUSES.includes(String(task.status || "").toUpperCase())) continue;

    const duration = Number(task.duration_minutes);
    const blockId = toId(task.block_id);
    const block = blockId ? blockById.get(blockId) : null;

    if (!blockId || !block) {
      unscheduled.push(makeUnscheduled(task, block, "NO_BLOCK"));
      continue;
    }
    if (!block.availability || String(block.status || "").toUpperCase() !== AVAILABLE_BLOCK_STATUS) {
      unscheduled.push(makeUnscheduled(task, block, "BLOCK_UNAVAILABLE"));
      continue;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      unscheduled.push(makeUnscheduled(task, block, "INVALID_DURATION"));
      continue;
    }
    if (duration > windowMinutes) {
      unscheduled.push(makeUnscheduled(task, block, "EXCEEDS_WINDOW"));
      continue;
    }

    candidates.push(task);
  }

  const groups = new Map();
  for (const task of candidates) {
    const key = toId(task.block_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  const megaBlocks = [];
  const scheduledTasks = [];
  const trainImpacts = [];
  const conflicts = [];

  const context = { windowStart, windowEnd, windowMinutes, movements };

  for (const [blockId, groupTasks] of groups) {
    const block = blockById.get(blockId);
    const result = scheduleBlockGroup(block, groupTasks, context);
    unscheduled.push(...result.unscheduled);
    if (!result.megaBlock) continue;

    const megaBlock = result.megaBlock;
    megaBlocks.push(megaBlock);

    for (const taskId of megaBlock.task_ids) {
      scheduledTasks.push({
        maintenance_task_id: taskId,
        block_id: megaBlock.block_id,
        block_code: megaBlock.block_code,
        planned_start: megaBlock.planned_start,
        planned_end: megaBlock.planned_end,
      });
    }

    for (const conflict of result.conflicts) {
      conflicts.push(conflict);
      trainImpacts.push({
        train_id: conflict.train_id,
        train_number: conflict.train_number,
        block_id: conflict.block_id,
        block_code: conflict.block_code,
        estimated_delay_minutes: conflict.estimated_delay_minutes,
        impact_type: "TRAIN_MAINTENANCE",
      });
    }
  }

  const totalWeight = candidates.reduce((sum, task) => sum + taskWeight(task), 0);
  const scheduledWeight = candidates
    .filter((task) => scheduledTasks.some((entry) => entry.maintenance_task_id === toId(task.maintenance_task_id)))
    .reduce((sum, task) => sum + taskWeight(task), 0);
  const scheduledDuration = megaBlocks.reduce((sum, block) => sum + block.duration_minutes, 0);
  const totalDelay = conflicts.reduce((sum, conflict) => sum + conflict.estimated_delay_minutes, 0);
  const affectedTrainCount = new Set(conflicts.map((conflict) => conflict.train_id)).size;
  const ratio = totalWeight > 0 ? scheduledWeight / totalWeight : 0;

  const optimizationScore = compositeScore({
    ratio,
    delay: totalDelay,
    scheduledDuration,
    conflictCount: conflicts.length,
    scheduledCount: scheduledTasks.length,
  });

  return {
    planning_window: {
      start: windowStart,
      end: windowEnd,
    },
    mega_blocks: megaBlocks,
    scheduled_tasks: scheduledTasks,
    unscheduled_tasks: unscheduled,
    train_impacts: trainImpacts,
    conflicts,
    metrics: {
      optimization_score: round(optimizationScore, 4),
      asset_availability_score: round(clamp(1 - scheduledDuration / windowMinutes, 0, 1), 4),
      tasks_scheduled: scheduledTasks.length,
      tasks_unscheduled: unscheduled.length,
      mega_block_count: megaBlocks.length,
      conflict_count: conflicts.length,
      affected_train_count: affectedTrainCount,
      estimated_delay_minutes: round(totalDelay, 2),
      scheduled_duration_minutes: scheduledDuration,
    },
  };
}

module.exports = { generateSchedule, sortByPriority, taskWeight, compositeScore };

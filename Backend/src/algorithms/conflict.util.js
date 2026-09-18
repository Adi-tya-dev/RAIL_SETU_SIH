const { addMinutes, overlapMinutes, round, clamp, startOfUtcDay, timeOfDayMs } = require("../utils/time.util");

const CONFLICT_BUFFER_MINUTES = 10;
const HIGH_OVERLAP_MINUTES = 30;

const TRAIN_PRIORITY_SEVERITY = { 1: 4, 2: 3, 3: 3, 4: 2 };

function toId(value) {
  return value === undefined || value === null ? null : String(value);
}

function severityFor(priority, overlap) {
  const base = TRAIN_PRIORITY_SEVERITY[priority] ?? 3;
  const boost = overlap >= HIGH_OVERLAP_MINUTES ? 1 : 0;
  return clamp(base + boost, 1, 4);
}

function projectMovement(movement, dayAnchor) {
  const entry = new Date(movement.scheduled_entry);
  const exit = new Date(movement.scheduled_exit);
  const durationMs = Math.max(0, exit.getTime() - entry.getTime());
  const day = startOfUtcDay(dayAnchor);
  const projectedEntry = new Date(day.getTime() + timeOfDayMs(entry));
  return { entry: projectedEntry, exit: new Date(projectedEntry.getTime() + durationMs) };
}

function detectTrainConflicts({ movements, blockId, blockCode, windowStart, windowEnd, dayAnchor }) {
  const bufferStart = addMinutes(windowStart, -CONFLICT_BUFFER_MINUTES);
  const bufferEnd = addMinutes(windowEnd, CONFLICT_BUFFER_MINUTES);
  const anchor = dayAnchor || windowStart;
  const byTrain = new Map();

  for (const movement of movements) {
    const { entry, exit } = projectMovement(movement, anchor);
    const overlap = overlapMinutes(bufferStart, bufferEnd, entry, exit);
    if (overlap <= 0) continue;

    const train = movement.train || {};
    const trainId = toId(movement.train_id);
    const trainNumber = train.train_number || movement.train_number || null;
    const priority = train.priority ?? movement.train_priority ?? null;
    const severity = severityFor(priority, overlap);

    const existing = byTrain.get(trainId);
    if (existing) {
      existing.estimated_delay_minutes += overlap;
      existing.severity = Math.max(existing.severity, severity);
      existing.overlap_count += 1;
      existing.first_overlap = existing.first_overlap < entry ? existing.first_overlap : entry;
    } else {
      byTrain.set(trainId, {
        block_id: blockId,
        block_code: blockCode,
        train_id: trainId,
        train_number: trainNumber,
        conflict_type: "TRAIN_MAINTENANCE",
        severity,
        estimated_delay_minutes: overlap,
        overlap_count: 1,
        first_overlap: entry,
        resolved: false,
      });
    }
  }

  return [...byTrain.values()].map((conflict) => {
    const delay = round(conflict.estimated_delay_minutes, 2);
    const label = conflict.train_number ? `Train ${conflict.train_number}` : "A train";
    const occurrences = conflict.overlap_count > 1 ? ` across ${conflict.overlap_count} movements` : "";
    return {
      block_id: conflict.block_id,
      block_code: conflict.block_code,
      train_id: conflict.train_id,
      train_number: conflict.train_number,
      conflict_type: conflict.conflict_type,
      severity: conflict.severity,
      estimated_delay_minutes: delay,
      resolved: false,
      description: `${label} is scheduled through block ${conflict.block_code} and overlaps the maintenance closure by ${delay} min${occurrences}.`,
    };
  });
}

module.exports = { detectTrainConflicts, projectMovement, CONFLICT_BUFFER_MINUTES };

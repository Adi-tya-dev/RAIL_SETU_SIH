/**
 * Conflict Detection Service
 *
 * Scans all train block movements against maintenance task windows and
 * generates BlockPlan + BlockConflict records in the database.
 *
 * Conflict types detected:
 *  - TRAIN_MAINTENANCE: A train traverses a block during its maintenance window
 *  - MAINTENANCE_MAINTENANCE: Two DIFFERENT maintenance tasks overlap on the same block
 *  - BLOCK_UNAVAILABLE: A maintenance task requires a block that is UNAVAILABLE
 *  - TRAIN_TRAIN_MOVEMENT: Two trains occupy the same block at the same time
 */

const prisma = require("../config/prisma");
const logger = require("../utils/logger");

function overlaps(startA, endA, startB, endB) {
  const [sa, ea, sb, eb] = [startA, endA, startB, endB].map((v) => new Date(v).getTime());
  if ([sa, ea, sb, eb].some(Number.isNaN)) return false;
  return sa < eb && ea > sb;
}

function severityScore(criticality, priority) {
  const c = Number(criticality) || 1;
  const p = Number(priority) || 3;
  if (c >= 4 && p === 1) return 5;
  if (c >= 4) return 4;
  if (c >= 3 && p <= 2) return 4;
  if (c >= 3) return 3;
  if (c >= 2 && p === 1) return 3;
  if (c >= 2) return 2;
  return 1;
}

async function detectAndPersist() {
  logger.info("[conflictDetection] Starting conflict detection run...");
  const t0 = Date.now();

  // ── Load all relevant data ───────────────────────────────────────────────
  const [movements, tasks] = await Promise.all([
    prisma.trainBlockMovement.findMany({
      include: {
        train: { include: { origin_station: true, destination_station: true } },
        block: { include: { track: { include: { section: true } } } },
      },
    }),
    prisma.maintenanceTask.findMany({
      where: { preferred_start: { not: null } },
      include: { block: true, section: true },
    }),
  ]);

  logger.info(`[conflictDetection] Loaded ${movements.length} movements, ${tasks.length} tasks in ${Date.now() - t0}ms`);

  // ── Group movements by block ─────────────────────────────────────────────
  const movementsByBlock = new Map();
  for (const m of movements) {
    if (!m.block_id || !m.scheduled_entry || !m.scheduled_exit) continue;
    const bId = String(m.block_id);
    if (!movementsByBlock.has(bId)) movementsByBlock.set(bId, []);
    movementsByBlock.get(bId).push(m);
  }

  // ── Group tasks by block ─────────────────────────────────────────────────
  const tasksByBlock = new Map();
  for (const t of tasks) {
    if (!t.block_id || !t.preferred_start) continue;
    const bId = String(t.block_id);
    if (!tasksByBlock.has(bId)) tasksByBlock.set(bId, []);
    tasksByBlock.get(bId).push(t);
  }

  // Use a global deduplication set so same conflict isn't recorded twice
  const globalConflictKeys = new Set();
  const detectedConflicts = [];

  function addConflict(conflict) {
    // Dedup key: type + train_id + block_id + description
    const key = `${conflict.type}||${conflict.train_id || "null"}||${conflict.block_id || "null"}||${(conflict.description || "").trim()}`;
    if (globalConflictKeys.has(key)) return;
    globalConflictKeys.add(key);
    detectedConflicts.push(conflict);
  }

  // ── 1. TRAIN vs MAINTENANCE conflicts ────────────────────────────────────
  for (const task of tasks) {
    if (!task.preferred_start || !task.block_id) continue;
    const bId = String(task.block_id);
    const blkMoves = movementsByBlock.get(bId);
    if (!blkMoves || blkMoves.length === 0) continue;

    const taskStart = new Date(task.preferred_start);
    const taskDuration = Math.max(Number(task.duration_minutes) || 60, 30); // min 30 min window
    const taskEnd = new Date(taskStart.getTime() + taskDuration * 60_000);

    for (const m of blkMoves) {
      if (!overlaps(m.scheduled_entry, m.scheduled_exit, taskStart, taskEnd)) continue;
      const severity = severityScore(task.criticality, m.train?.priority);
      addConflict({
        type: "TRAIN_MAINTENANCE",
        severity,
        description: `Train ${m.train?.train_number} (${m.train?.train_name || ""}) occupies block ${task.block?.block_code || bId} during ${task.maintenance_type} maintenance window.`,
        train_id: m.train_id,
        block: task.block,
        block_id: task.block_id,
        task,
      });
    }
  }

  // ── 2. MAINTENANCE vs MAINTENANCE (different tasks, real time overlap) ───
  for (const [bId, blkTasks] of tasksByBlock.entries()) {
    blkTasks.sort((x, y) => new Date(x.preferred_start).getTime() - new Date(y.preferred_start).getTime());

    for (let i = 0; i < blkTasks.length; i++) {
      const a = blkTasks[i];
      const aId = String(a.maintenance_task_id);
      const aStart = new Date(a.preferred_start);
      const aDuration = Math.max(Number(a.duration_minutes) || 60, 30);
      const aEnd = new Date(aStart.getTime() + aDuration * 60_000);

      for (let j = i + 1; j < blkTasks.length; j++) {
        const b = blkTasks[j];
        const bId2 = String(b.maintenance_task_id);

        // Skip if same task ID (degenerate duplicate in DB)
        if (aId === bId2) continue;

        const bStart = new Date(b.preferred_start);
        // If B starts after A ends, we can break early (sorted by start)
        if (bStart.getTime() >= aEnd.getTime()) break;

        const bDuration = Math.max(Number(b.duration_minutes) || 60, 30);
        const bEnd = new Date(bStart.getTime() + bDuration * 60_000);

        if (!overlaps(aStart, aEnd, bStart, bEnd)) continue;

        const severity = Math.max(severityScore(a.criticality, 3), severityScore(b.criticality, 3));
        addConflict({
          type: "MAINTENANCE_MAINTENANCE",
          severity,
          description: `Two maintenance tasks (${a.title || a.maintenance_type} & ${b.title || b.maintenance_type}) overlap on block ${a.block?.block_code || bId}.`,
          train_id: null,
          block: a.block,
          block_id: a.block_id,
          task: a,
          taskB: b,
        });
      }
    }
  }

  // ── 3. TRAIN vs TRAIN movement conflicts ─────────────────────────────────
  for (const [bId, blkMoves] of movementsByBlock.entries()) {
    blkMoves.sort((x, y) => new Date(x.scheduled_entry).getTime() - new Date(y.scheduled_entry).getTime());

    for (let i = 0; i < blkMoves.length; i++) {
      const a = blkMoves[i];
      const aExit = new Date(a.scheduled_exit).getTime();
      const aTrainId = String(a.train_id);

      for (let j = i + 1; j < blkMoves.length; j++) {
        const b = blkMoves[j];
        // Since sorted by entry, if B's entry >= A's exit, no more overlaps for A
        if (new Date(b.scheduled_entry).getTime() >= aExit) break;

        const bTrainId = String(b.train_id);
        if (aTrainId === bTrainId) continue;
        if (!overlaps(a.scheduled_entry, a.scheduled_exit, b.scheduled_entry, b.scheduled_exit)) continue;

        // Only record as train A's conflict (a.train_id is the "primary" train in this conflict)
        const severity = Math.min(
          Math.max(severityScore(3, a.train?.priority), severityScore(3, b.train?.priority)) + 1,
          5
        );
        addConflict({
          type: "TRAIN_TRAIN_MOVEMENT",
          severity,
          description: `Train ${a.train?.train_number} and Train ${b.train?.train_number} both occupy block ${a.block?.block_code || bId} simultaneously.`,
          train_id: a.train_id,
          block: a.block,
          block_id: a.block_id,
          movementA: a,
          movementB: b,
        });
      }
    }
  }

  // ── 4. BLOCK_UNAVAILABLE ─────────────────────────────────────────────────
  for (const task of tasks) {
    if (!task.block_id || !task.block) continue;
    if (task.block.status === "UNAVAILABLE" || !task.block.availability) {
      addConflict({
        type: "BLOCK_UNAVAILABLE",
        severity: 4,
        description: `Maintenance task "${task.title || task.maintenance_type}" is scheduled on block ${task.block.block_code} which is currently UNAVAILABLE.`,
        train_id: null,
        block: task.block,
        block_id: task.block_id,
        task,
      });
    }
  }

  logger.info(`[conflictDetection] Detected ${detectedConflicts.length} unique conflicts in ${Date.now() - t0}ms`);

  // ── Clear ALL previously auto-detected plans and conflicts ────────────────
  // This ensures a clean slate every time detection runs
  await prisma.blockConflict.deleteMany({ where: { plan: { status: "AUTO_DETECTED" } } });
  await prisma.blockPlan.deleteMany({ where: { status: "AUTO_DETECTED" } });

  if (detectedConflicts.length === 0) {
    logger.info("[conflictDetection] No conflicts detected. Done.");
    return { created: 0, conflicts: [] };
  }

  // ── Group conflicts by block to create one plan per block ────────────────
  const blockGroups = new Map();
  for (const conflict of detectedConflicts) {
    const key = String(conflict.block_id || "unknown");
    if (!blockGroups.has(key)) blockGroups.set(key, []);
    blockGroups.get(key).push(conflict);
  }

  const now = new Date();
  let totalCreated = 0;

  for (const [blockId, blockConflicts] of blockGroups.entries()) {
    const blockIdNum = Number(blockId);
    if (Number.isNaN(blockIdNum)) continue;

    const anchorTask = blockConflicts.map((c) => c.task || c.taskB).find(Boolean);
    const planStart = anchorTask?.preferred_start ? new Date(anchorTask.preferred_start) : now;
    const planEnd = new Date(planStart.getTime() + 7 * 86400000);

    let plan;
    try {
      plan = await prisma.blockPlan.create({
        data: {
          block_id: BigInt(blockIdNum),
          planned_start: planStart,
          planned_end: planEnd,
          status: "AUTO_DETECTED",
          plan_horizon: "WEEKLY",
          affected_train_count: new Set(
            blockConflicts.map((c) => String(c.train_id)).filter(Boolean)
          ).size,
          expected_delay_minutes: 0,
        },
      });
    } catch (err) {
      logger.warn(`[conflictDetection] Could not create plan for block ${blockId}: ${err.message}`);
      continue;
    }

    const conflictRecords = blockConflicts.map((conflict) => ({
      plan_id: plan.plan_id,
      train_id: conflict.train_id ? BigInt(conflict.train_id) : null,
      conflict_type: conflict.type,
      severity: conflict.severity,
      description: conflict.description,
      resolved: false,
    }));

    try {
      await prisma.blockConflict.createMany({ data: conflictRecords });
      totalCreated += conflictRecords.length;
    } catch (err) {
      logger.warn(`[conflictDetection] Could not batch insert conflicts for block ${blockId}: ${err.message}`);
    }
  }

  logger.info(`[conflictDetection] Complete! Created ${totalCreated} conflict records in DB in ${Date.now() - t0}ms`);
  return { created: totalCreated, conflicts: detectedConflicts };
}

async function ensureConflicts(force = false) {
  const count = await prisma.blockConflict.count();
  if (count === 0 || force) {
    logger.info(`[conflictDetection] ensureConflicts: count=${count}, force=${force}, triggering detection`);
    return detectAndPersist();
  }
  return { created: 0, skipped: true, existing: count };
}

module.exports = { detectAndPersist, ensureConflicts };

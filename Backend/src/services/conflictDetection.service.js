/**
 * Conflict Detection Service
 * 
 * Scans all train block movements against maintenance task windows and
 * generates BlockPlan + BlockConflict records in the database.
 *
 * Conflict types detected:
 *  - TRAIN_MAINTENANCE: A train traverses a block during its maintenance window
 *  - MAINTENANCE_MAINTENANCE: Two maintenance tasks overlap on the same block
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
  // Criticality 4 + high priority train = severity 5 (max)
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

  // ── Load all relevant data ───────────────────────────────────────────────
  const [movements, tasks, trains] = await Promise.all([
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
    prisma.train.findMany({ include: { origin_station: true, destination_station: true } }),
  ]);

  logger.info(`[conflictDetection] Loaded ${movements.length} movements, ${tasks.length} tasks, ${trains.length} trains`);

  // ── Clear existing auto-detected plans/conflicts ─────────────────────────
  await prisma.blockConflict.deleteMany({ where: { plan: { status: "AUTO_DETECTED" } } });
  await prisma.blockPlan.deleteMany({ where: { status: "AUTO_DETECTED" } });

  const detectedConflicts = [];

  // ── 1. TRAIN vs MAINTENANCE conflicts ────────────────────────────────────
  for (const task of tasks) {
    if (!task.preferred_start || !task.block_id) continue;
    const taskStart = new Date(task.preferred_start);
    const taskEnd = new Date(taskStart.getTime() + (Number(task.duration_minutes) || 60) * 60_000);

    const collidingMovements = movements.filter(
      (m) =>
        String(m.block_id) === String(task.block_id) &&
        m.scheduled_entry &&
        m.scheduled_exit &&
        overlaps(m.scheduled_entry, m.scheduled_exit, taskStart, taskEnd)
    );

    for (const movement of collidingMovements) {
      const severity = severityScore(task.criticality, movement.train?.priority);
      detectedConflicts.push({
        type: "TRAIN_MAINTENANCE",
        severity,
        description: `Train ${movement.train?.train_number} (${movement.train?.train_name}) occupies block ${task.block?.block_code} during ${task.maintenance_type} maintenance window (${taskStart.toISOString()} – ${taskEnd.toISOString()}).`,
        train_id: movement.train_id,
        block: task.block,
        block_id: task.block_id,
        task,
        movement,
      });
    }
  }

  // ── 2. MAINTENANCE vs MAINTENANCE conflicts (same block) ─────────────────
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      if (!a.preferred_start || !b.preferred_start) continue;
      if (String(a.block_id) !== String(b.block_id)) continue;

      const aStart = new Date(a.preferred_start);
      const aEnd = new Date(aStart.getTime() + (Number(a.duration_minutes) || 60) * 60_000);
      const bStart = new Date(b.preferred_start);
      const bEnd = new Date(bStart.getTime() + (Number(b.duration_minutes) || 60) * 60_000);

      if (!overlaps(aStart, aEnd, bStart, bEnd)) continue;

      const severity = Math.max(severityScore(a.criticality, 3), severityScore(b.criticality, 3));
      detectedConflicts.push({
        type: "MAINTENANCE_MAINTENANCE",
        severity,
        description: `Two maintenance tasks (${a.maintenance_type} & ${b.maintenance_type}) overlap on block ${a.block?.block_code} during ${aStart.toISOString()} – ${bEnd.toISOString()}.`,
        train_id: null,
        block: a.block,
        block_id: a.block_id,
        task: a,
        taskB: b,
      });
    }
  }

  // ── 3. TRAIN vs TRAIN movement conflicts (same block same time) ───────────
  const movementsByBlock = new Map();
  for (const m of movements) {
    if (!m.block_id || !m.scheduled_entry || !m.scheduled_exit) continue;
    const bId = String(m.block_id);
    if (!movementsByBlock.has(bId)) movementsByBlock.set(bId, []);
    movementsByBlock.get(bId).push(m);
  }

  for (const [bId, blkMoves] of movementsByBlock.entries()) {
    blkMoves.sort((x, y) => new Date(x.scheduled_entry).getTime() - new Date(y.scheduled_entry).getTime());
    const seenTrainPairs = new Set();

    for (let i = 0; i < blkMoves.length; i++) {
      const a = blkMoves[i];
      for (let j = i + 1; j < Math.min(blkMoves.length, i + 3); j++) {
        const b = blkMoves[j];
        if (String(a.train_id) === String(b.train_id)) continue;
        if (!overlaps(a.scheduled_entry, a.scheduled_exit, b.scheduled_entry, b.scheduled_exit)) continue;

        const pairKey = [String(a.train_id), String(b.train_id)].sort().join("-") + `-${bId}`;
        if (seenTrainPairs.has(pairKey)) continue;
        seenTrainPairs.add(pairKey);

        const severity = Math.max(
          severityScore(3, a.train?.priority),
          severityScore(3, b.train?.priority)
        );
        detectedConflicts.push({
          type: "TRAIN_TRAIN_MOVEMENT",
          severity: Math.min(severity + 1, 5),
          description: `Train ${a.train?.train_number} and Train ${b.train?.train_number} both occupy block ${a.block?.block_code} simultaneously.`,
          train_id: a.train_id,
          block: a.block,
          block_id: a.block_id,
          movementA: a,
          movementB: b,
        });
      }
    }
  }

  // ── 4. BLOCK_UNAVAILABLE: maintenance on already-UNAVAILABLE blocks ───────
  for (const task of tasks) {
    if (!task.block_id || !task.block) continue;
    if (task.block.status === "UNAVAILABLE" || !task.block.availability) {
      detectedConflicts.push({
        type: "BLOCK_UNAVAILABLE",
        severity: 4,
        description: `Maintenance task "${task.maintenance_type}" is scheduled on block ${task.block.block_code} which is currently UNAVAILABLE.`,
        train_id: null,
        block: task.block,
        block_id: task.block_id,
        task,
      });
    }
  }

  logger.info(`[conflictDetection] Detected ${detectedConflicts.length} conflicts`);

  if (detectedConflicts.length === 0) {
    logger.info("[conflictDetection] No conflicts detected. Done.");
    return { created: 0, conflicts: [] };
  }

  // ── Create a master AUTO_DETECTED plan ───────────────────────────────────
  // Group conflicts by block to create one plan per block
  const blockGroups = new Map();
  for (const conflict of detectedConflicts) {
    const key = String(conflict.block_id || "unknown");
    if (!blockGroups.has(key)) blockGroups.set(key, []);
    blockGroups.get(key).push(conflict);
  }

  let totalCreated = 0;
  const allCreatedConflicts = [];

  for (const [blockId, blockConflicts] of blockGroups.entries()) {
    const block = blockConflicts[0].block;
    const blockIdNum = Number(blockId);
    if (Number.isNaN(blockIdNum)) continue;

    // Find a relevant maintenance task for this block (to anchor the plan)
    const anchorTask = blockConflicts
      .map((c) => c.task || c.taskB)
      .find(Boolean);

    const planStart = anchorTask?.preferred_start
      ? new Date(anchorTask.preferred_start)
      : new Date();
    const planEnd = new Date(planStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 1-week window

    // Create a block plan
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
      // Link maintenance tasks for this block to the plan
      const taskIds = [
        ...new Set(
          blockConflicts
            .flatMap((c) => [c.task?.maintenance_task_id, c.taskB?.maintenance_task_id])
            .filter(Boolean)
        ),
      ];
      for (const tId of taskIds) {
        try {
          await prisma.planMaintenanceTask.create({
            data: {
              plan_id: plan.plan_id,
              maintenance_task_id: BigInt(tId),
            },
          });
        } catch (_) {}
      }
    } catch (err) {
      logger.warn(`[conflictDetection] Could not create plan for block ${blockId}: ${err.message}`);
      continue;
    }

    // Create conflict records for this plan
    for (const conflict of blockConflicts) {
      try {
        const created = await prisma.blockConflict.create({
          data: {
            plan_id: plan.plan_id,
            train_id: conflict.train_id ? BigInt(conflict.train_id) : null,
            conflict_type: conflict.type,
            severity: conflict.severity,
            description: conflict.description,
            resolved: false,
          },
          include: {
            train: { include: { origin_station: true, destination_station: true } },
            plan: { include: { block: { include: { track: { include: { section: true } } } } } },
          },
        });
        allCreatedConflicts.push({
          ...created,
          block: created.plan?.block || block,
        });
        totalCreated++;
      } catch (err) {
        logger.warn(`[conflictDetection] Could not create conflict: ${err.message}`);
      }
    }
  }

  logger.info(`[conflictDetection] Created ${totalCreated} conflict records in DB`);
  return { created: totalCreated, conflicts: allCreatedConflicts };
}

/**
 * Run detection only if no conflicts exist yet, or force=true
 */
async function ensureConflicts(force = false) {
  const count = await prisma.blockConflict.count();
  if (count > 0 && !force) {
    logger.info(`[conflictDetection] ${count} conflicts already exist, skipping detection`);
    return { skipped: true, count };
  }
  return detectAndPersist();
}

module.exports = { detectAndPersist, ensureConflicts };

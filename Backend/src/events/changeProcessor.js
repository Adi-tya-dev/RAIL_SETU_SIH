/**
 * changeProcessor.js — Subscriber that processes every "new_request" event.
 *
 * For each new maintenance request detected by simulatorWatcher:
 *   1. Upsert the task into the DB (MaintenanceTask)
 *   2. Check if the task's block/section overlaps with the currently active BlockPlan
 *   3a. If YES  → run the full 3-stage planning pipeline → save new plan → broadcast "plan_updated"
 *   3b. If NO   → task stays PENDING → broadcast "request_stored"
 *   4. Either way, the SSE broadcast reaches every connected browser tab immediately.
 */
"use strict";

const prisma        = require("../config/prisma");
const logger        = require("../utils/logger");
const eventBus      = require("./eventBus");
const sseManager    = require("./sseManager");
const { runBlockPlanningPipeline } = require("../services/blockPlanning.service");

const ACTIVE_PLAN_STATUSES = ["ACTIVE", "PROPOSED", "APPROVED"];

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the latest "active" BlockPlan from the DB.
 * Falls back to the most recently created plan if none has status ACTIVE/APPROVED.
 */
async function getActivePlan() {
  try {
    const plan = await prisma.blockPlan.findFirst({
      where: { status: { in: ACTIVE_PLAN_STATUSES } },
      orderBy: { created_at: "desc" },
    });
    if (plan) return plan;
    // fallback: latest plan regardless of status
    return await prisma.blockPlan.findFirst({ orderBy: { created_at: "desc" } });
  } catch (err) {
    logger.warn(`[changeProcessor] Could not query active plan: ${err.message}`);
    return null;
  }
}

/**
 * Does the new task's block or section appear anywhere in the current plan?
 *
 * The stored plan has a JSON `result` field that contains the pipeline output.
 * We look for matching block_code / section_code in the work_packages or schedules arrays.
 */
function planContainsTask(plan, task) {
  if (!plan) return false;
  let result = plan.result;
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch { return false; }
  }
  if (!result || typeof result !== "object") return false;

  const blockCode   = task.block_code   || task.blockCode   || null;
  const sectionCode = task.section_code || task.sectionCode || null;
  if (!blockCode && !sectionCode) return false;

  const searchIn = [
    ...(result.work_packages || []),
    ...(result.schedules     || []),
  ];

  for (const item of searchIn) {
    const codes = [
      item.block_code,
      item.block_codes,
      ...(Array.isArray(item.block_codes) ? item.block_codes : []),
      item.section_code,
    ].flat().filter(Boolean);

    if (blockCode   && codes.includes(blockCode))   return true;
    if (sectionCode && codes.includes(sectionCode)) return true;
  }
  return false;
}

/**
 * Upsert the new task into the MaintenanceTask table.
 * Matches on (source, external_ref). Returns { task, isNew }.
 */
async function persistTask(rawTask) {
  const externalRef = rawTask.request_id || rawTask.externalRef || rawTask.external_ref;
  const source      = rawTask.source || "UNKNOWN";

  const reqDate = rawTask.requested_at || rawTask.requestedAt
    ? new Date(rawTask.requested_at || rawTask.requestedAt)
    : new Date();

  const prefDateRaw = rawTask.preferred_start || rawTask.preferredStart;
  const prefDate = prefDateRaw
    ? new Date(prefDateRaw)
    : new Date(reqDate.getTime() + 2 * 3600 * 1000);

  const deadDateRaw = rawTask.deadline || rawTask.deadlineAt;
  const deadDate = deadDateRaw
    ? new Date(deadDateRaw)
    : new Date(prefDate.getTime() + 4 * 3600 * 1000);

  const data = {
    source,
    external_ref:      externalRef,
    department:        rawTask.department,
    maintenance_type:  rawTask.maintenance_type || rawTask.maintenanceType,
    description:       rawTask.description,
    priority:          Number(rawTask.priority   || 1),
    criticality:       Number(rawTask.criticality || 1),
    urgency:           Number(rawTask.urgency     || 1),
    duration_minutes:  Number(rawTask.duration_minutes || rawTask.durationMinutes || 60),
    requested_at:      reqDate,
    preferred_start:   prefDate,
    deadline:          deadDate,
    status:            rawTask.status || "PENDING",
  };

  try {
    // Try to find the block & section to link foreign keys
    if (rawTask.block_code || rawTask.blockCode) {
      const blockCode = rawTask.block_code || rawTask.blockCode;
      const block = await prisma.block.findFirst({ where: { block_code: blockCode } });
      if (block) data.block_id = block.block_id;
    }
    if (rawTask.asset_code || rawTask.assetCode) {
      const assetCode = rawTask.asset_code || rawTask.assetCode;
      const asset = await prisma.asset.findFirst({ where: { asset_code: assetCode } });
      if (asset) data.asset_id = asset.asset_id;
    }
    if (rawTask.section_code || rawTask.sectionCode) {
      const sectionCode = rawTask.section_code || rawTask.sectionCode;
      const section = await prisma.section.findFirst({ where: { section_code: sectionCode } });
      if (section) data.section_id = section.section_id;
    }
  } catch (err) {
    logger.warn(`[changeProcessor] FK resolution skipped: ${err.message}`);
  }

  try {
    const existing = await prisma.maintenanceTask.findFirst({
      where: { source, external_ref: externalRef },
    });

    if (existing) {
      return { task: existing, isNew: false };
    }

    const created = await prisma.maintenanceTask.create({ data });
    return { task: created, isNew: true };
  } catch (err) {
    logger.warn(`[changeProcessor] DB upsert skipped (DB may be offline): ${err.message}`);
    // Return a virtual task so the flow still completes
    return { task: { ...data, maintenance_task_id: `VIRTUAL-${externalRef}` }, isNew: true };
  }
}

// ─── main processor ─────────────────────────────────────────────────────────

async function processNewRequest({ source, task: rawTask }) {
  logger.info(`[changeProcessor] Processing new request from ${source}: ${rawTask.request_id || rawTask.external_ref}`);

  // 1. Persist to DB
  const { task, isNew } = await persistTask({ ...rawTask, source });

  if (!isNew) {
    logger.info(`[changeProcessor] Request already stored — skipping. ref=${task.external_ref}`);
    return;
  }

  // 2. Check active plan overlap
  const activePlan  = await getActivePlan();
  const affectsPlan = planContainsTask(activePlan, rawTask);

  logger.info(`[changeProcessor] Task stored (id=${task.maintenance_task_id}). Affects active plan: ${affectsPlan}`);

  if (affectsPlan && activePlan) {
    // 3a. Replan
    logger.info(`[changeProcessor] Triggering auto-replan — task hits active plan blocks.`);
    try {
      const pipelineResult = await runBlockPlanningPipeline();

      // Persist the new plan if we have a BlockPlan table
      let newPlanId = null;
      try {
        const saved = await prisma.blockPlan.create({
          data: {
            status:      "PROPOSED",
            generated_at: new Date(),
            result:      pipelineResult,
            trigger:     "AUTO_REPLAN",
            trigger_ref: String(task.maintenance_task_id),
          },
        });
        newPlanId = saved.block_plan_id;
      } catch (err) {
        logger.warn(`[changeProcessor] Could not save new plan to DB: ${err.message}`);
      }

      // Broadcast to all SSE clients
      sseManager.broadcast("plan_updated", {
        reason:       "new_request_affected_active_plan",
        source,
        task: {
          id:           task.maintenance_task_id ? String(task.maintenance_task_id) : null,
          external_ref: task.external_ref,
          department:   task.department,
          maintenance_type: task.maintenance_type,
          block_code:   rawTask.block_code || rawTask.blockCode,
          section_code: rawTask.section_code || rawTask.sectionCode,
        },
        plan_id:      newPlanId ? String(newPlanId) : null,
        pipeline_summary: {
          packages: pipelineResult.data_summary?.work_packages_generated,
          assigned: pipelineResult.optimization_metrics?.assigned_packages,
          efficiency: pipelineResult.optimization_metrics?.efficiency_rate,
        },
        ts: new Date().toISOString(),
      });

      eventBus.emit("plan_updated", { reason: "auto_replan", task, newPlanId });
      logger.info(`[changeProcessor] Auto-replan complete. New plan id=${newPlanId}`);
    } catch (err) {
      logger.error(`[changeProcessor] Auto-replan failed: ${err.message}`);
      // Still broadcast the raw request even if replan failed
      sseManager.broadcast("new_request", buildRequestPayload(source, task, rawTask, false));
    }
  } else {
    // 3b. No overlap — just notify
    sseManager.broadcast("new_request", buildRequestPayload(source, task, rawTask, false));
    eventBus.emit("request_stored", { source, task });
    logger.info(`[changeProcessor] Task stored as PENDING — no active plan conflict.`);
  }
}

function buildRequestPayload(source, task, rawTask, affectsPlan) {
  const reqDate = task.requested_at || rawTask.requested_at || rawTask.requestedAt || new Date();
  const recDate = task.created_at || task.received_at || new Date();
  const prefDate = task.preferred_start || rawTask.preferred_start || rawTask.preferredStart || new Date(new Date(reqDate).getTime() + 2 * 3600 * 1000);
  const deadDate = task.deadline || rawTask.deadline || new Date(new Date(prefDate).getTime() + 4 * 3600 * 1000);
  const status = task.status || rawTask.status || "PENDING";
  const isCompleted = status === "COMPLETED";
  const isInProgress = status === "IN_PROGRESS";
  const actualStart = (isInProgress || isCompleted) ? (task.actual_start || prefDate) : null;
  const completedAt = isCompleted ? (task.completed_at || new Date()) : null;
  const completedWithinDeadline = isCompleted && deadDate ? new Date(completedAt) <= new Date(deadDate) : null;

  return {
    source,
    affects_active_plan: affectsPlan,
    task: {
      id:                         task.maintenance_task_id ? String(task.maintenance_task_id) : null,
      external_ref:               task.external_ref,
      department:                 task.department,
      maintenance_type:           task.maintenance_type,
      description:                task.description,
      priority:                   task.priority,
      criticality:                task.criticality,
      urgency:                    task.urgency,
      duration_minutes:           task.duration_minutes || rawTask.duration_minutes || rawTask.durationMinutes || 60,
      block_code:                 rawTask.block_code || rawTask.blockCode,
      section_code:               rawTask.section_code || rawTask.sectionCode,
      requested_at:               new Date(reqDate).toISOString(),
      received_at:                new Date(recDate).toISOString(),
      created_at:                 new Date(recDate).toISOString(),
      preferred_start:            new Date(prefDate).toISOString(),
      deadline:                   new Date(deadDate).toISOString(),
      actual_start:               actualStart ? new Date(actualStart).toISOString() : null,
      completed_at:               completedAt ? new Date(completedAt).toISOString() : null,
      completed_within_deadline:  completedWithinDeadline,
      status:                     status,
    },
    ts: new Date().toISOString(),
  };
}

// ─── bootstrap ──────────────────────────────────────────────────────────────

function start() {
  eventBus.on("new_request", (payload) => {
    processNewRequest(payload).catch((err) =>
      logger.error(`[changeProcessor] Unhandled error: ${err.message}`)
    );
  });
  logger.info("[changeProcessor] Subscribed to new_request events.");
}

module.exports = { start, processNewRequest };

const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");

const CRITICAL_THRESHOLD = 4;
const ACTIVE_TRAIN_STATUS = "ACTIVE";
const PENDING_TASK_STATUS = "PENDING";
const COMPLETED_TASK_STATUS = "COMPLETED";
const DEFECTIVE_ASSET_STATUS = "DEFECTIVE";
const TERMINAL_PLAN_STATUSES = ["COMPLETED", "CANCELLED"];

// ─────────────────────────────────────────────────────────────────────────────
// Operational KPI Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * countOverdueTasks — tasks past deadline that are not completed/cancelled
 */
function countOverdueTasks(tasks) {
  const now = Date.now();
  return tasks.filter(
    (t) => t.deadline && new Date(t.deadline).getTime() < now &&
    !['COMPLETED', 'CANCELLED'].includes(t.status)
  ).length;
}

/**
 * computeAvgOptScore — average optimization_score across non-terminal plans
 */
function computeAvgOptScore(plans) {
  const activePlans = plans.filter(
    (p) => !TERMINAL_PLAN_STATUSES.includes(p.status) && typeof p.optimization_score === 'number'
  );
  if (activePlans.length === 0) return null;
  const total = activePlans.reduce((sum, p) => sum + p.optimization_score, 0);
  return Math.round((total / activePlans.length) * 1000) / 1000;
}

/**
 * countPendingApproval — plans in PROPOSED state awaiting controller sign-off
 */
function countPendingApproval(plans) {
  return plans.filter((p) => p.status === 'PROPOSED').length;
}

/**
 * computeTimeSavedMins — total minutes saved via multi-crew clubbing across all plans
 */
function computeTimeSavedMins(plans) {
  return plans.reduce((sum, p) => sum + (Number(p.time_saved_mins) || 0), 0);
}

async function getSummary() {
  try {
    const [
      maintenanceTotal,
      maintenancePending,
      maintenanceCritical,
      maintenanceCompleted,
      blocksTotal,
      blocksAvailable,
      blocksUnavailable,
      trainsTotal,
      trainsActive,
      assetsTotal,
      assetsDefective,
      assetsCritical,
      plansTotal,
      plansActive,
    ] = await Promise.all([
      prisma.maintenanceTask.count(),
      prisma.maintenanceTask.count({ where: { status: PENDING_TASK_STATUS } }),
      prisma.maintenanceTask.count({ where: { criticality: CRITICAL_THRESHOLD } }),
      prisma.maintenanceTask.count({ where: { status: COMPLETED_TASK_STATUS } }),
      prisma.block.count(),
      prisma.block.count({ where: { availability: true } }),
      prisma.block.count({ where: { availability: false } }),
      prisma.train.count(),
      prisma.train.count({ where: { status: ACTIVE_TRAIN_STATUS } }),
      prisma.asset.count(),
      prisma.asset.count({ where: { status: DEFECTIVE_ASSET_STATUS } }),
      prisma.asset.count({ where: { criticality: CRITICAL_THRESHOLD } }),
      prisma.blockPlan.count(),
      prisma.blockPlan.count({ where: { status: { notIn: TERMINAL_PLAN_STATUSES } } }),
    ]);

    if (maintenanceTotal > 0 || blocksTotal > 0 || trainsTotal > 0) {
      return {
        maintenance: {
          total: maintenanceTotal,
          pending: maintenancePending,
          critical: maintenanceCritical,
          completed: maintenanceCompleted,
        },
        blocks: {
          total: blocksTotal,
          available: blocksAvailable,
          unavailable: blocksUnavailable,
        },
        trains: {
          total: trainsTotal,
          active: trainsActive,
        },
        assets: {
          total: assetsTotal,
          defective: assetsDefective,
          critical: assetsCritical,
        },
        plans: {
          total: plansTotal,
          active: plansActive,
        },
      };
    }
  } catch (err) {
    // Database offline or error, fall back to seed data
  }

  // Fallback to seed data statistics
  const mTasks = seedData.maintenanceTasks;
  const blks = seedData.blocks;
  const trns = seedData.trains;
  const asts = seedData.assets;
  const plns = seedData.blockPlans;

  return {
    maintenance: {
      total: mTasks.length,
      pending: mTasks.filter((t) => t.status === PENDING_TASK_STATUS).length,
      critical: mTasks.filter((t) => t.criticality === CRITICAL_THRESHOLD).length,
      completed: mTasks.filter((t) => t.status === COMPLETED_TASK_STATUS).length,
    },
    blocks: {
      total: blks.length,
      available: blks.filter((b) => b.availability).length,
      unavailable: blks.filter((b) => !b.availability).length,
    },
    trains: {
      total: trns.length,
      active: trns.filter((t) => t.status === ACTIVE_TRAIN_STATUS).length,
    },
    assets: {
      total: asts.length,
      defective: asts.filter((a) => a.status === DEFECTIVE_ASSET_STATUS || a.status === "NEEDS_REPAIR").length,
      critical: asts.filter((a) => a.criticality === CRITICAL_THRESHOLD).length,
    },
    plans: {
      total: plns.length,
      active: plns.filter((p) => !TERMINAL_PLAN_STATUSES.includes(p.status)).length,
    },
    optimization: {
      overdue_tasks:         countOverdueTasks(mTasks),
      pending_approval:      countPendingApproval(plns),
      avg_optimization_score: computeAvgOptScore(plns),
      total_time_saved_mins: computeTimeSavedMins(plns),
    },
  };
}

module.exports = { getSummary };
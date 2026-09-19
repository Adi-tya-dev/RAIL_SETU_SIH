const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");

const CRITICAL_THRESHOLD = 4;
const ACTIVE_TRAIN_STATUS = "ACTIVE";
const PENDING_TASK_STATUS = "PENDING";
const COMPLETED_TASK_STATUS = "COMPLETED";
const DEFECTIVE_ASSET_STATUS = "DEFECTIVE";
const TERMINAL_PLAN_STATUSES = ["COMPLETED", "CANCELLED"];

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
  };
}

module.exports = { getSummary };
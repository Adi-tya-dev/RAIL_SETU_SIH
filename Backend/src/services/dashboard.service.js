const prisma = require("../config/prisma");

const CRITICAL_THRESHOLD = 4;
const ACTIVE_TRAIN_STATUS = "ACTIVE";
const PENDING_TASK_STATUS = "PENDING";
const COMPLETED_TASK_STATUS = "COMPLETED";
const DEFECTIVE_ASSET_STATUS = "DEFECTIVE";
const TERMINAL_PLAN_STATUSES = ["COMPLETED", "CANCELLED"];

async function getSummary() {
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

module.exports = { getSummary };
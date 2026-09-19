/**
 * blockPlanning.controller.js
 *
 * Controller for the ML Block Planning pipeline endpoints:
 *
 *   POST /api/v1/block-planning/optimize
 *     → Runs the full 2-stage pipeline and returns the optimized schedule
 *
 *   GET  /api/v1/block-planning/tasks
 *     → Returns the raw normalized tasks (Stage 1 data) for inspection
 *
 *   GET  /api/v1/block-planning/windows
 *     → Returns available COA time windows
 */

"use strict";

const {
  runBlockPlanningPipeline,
  fetchMaintenanceTasks,
  fetchCoaWindows,
} = require("../services/blockPlanning.service");
const { generateWorkPackages } = require("../algorithms/clusteringEngine");

/**
 * POST /api/v1/block-planning/optimize
 *
 * Body (optional):
 *   { maxDistanceKm: number }  — cluster radius, default 2.0
 */
async function optimize(req, res) {
  const maxDistanceKm = Number(req.body?.maxDistanceKm) || 2.0;

  if (maxDistanceKm <= 0 || maxDistanceKm > 50) {
    return res.status(400).json({
      success: false,
      message: "maxDistanceKm must be between 0 and 50",
    });
  }

  const result = await runBlockPlanningPipeline({ maxDistanceKm });
  return res.status(200).json(result);
}

/**
 * GET /api/v1/block-planning/tasks
 *
 * Returns normalized raw task data fetched from all source APIs (TMS/SMMS/TDMS/COA).
 * Useful for debugging and for the frontend to show "what will be clustered".
 */
async function getRawTasks(req, res) {
  const tasks = await fetchMaintenanceTasks();
  return res.json({
    success: true,
    count: tasks.length,
    data: tasks,
  });
}

/**
 * GET /api/v1/block-planning/windows
 *
 * Returns available COA time windows used by the optimization engine.
 */
async function getWindows(req, res) {
  const windows = await fetchCoaWindows();
  return res.json({
    success: true,
    count: windows.length,
    data: windows,
  });
}

/**
 * POST /api/v1/block-planning/cluster-only
 *
 * Runs ONLY Stage 1 (spatial clustering) without optimization.
 * Useful for previewing how tasks cluster before scheduling.
 *
 * Body (optional):
 *   { maxDistanceKm: number }
 */
async function clusterOnly(req, res) {
  const maxDistanceKm = Number(req.body?.maxDistanceKm) || 2.0;
  const tasks = await fetchMaintenanceTasks();
  const workPackages = generateWorkPackages(tasks, maxDistanceKm);
  return res.json({
    success: true,
    raw_task_count: tasks.length,
    work_package_count: workPackages.length,
    clustering_radius_km: maxDistanceKm,
    data: workPackages,
  });
}

const {
  generateMonthlyBlueprint,
  generateWeeklyRefinement,
  getMonthlyPlans,
  getWeeklyPlans,
  approvePlan: approvePlanService,
  cancelPlan: cancelPlanService,
} = require("../services/twoHorizonPlanning.service");


/**
 * GET /api/v1/block-planning/monthly
 * Returns the 30-day strategic blueprint block plans.
 */
async function getMonthly(req, res) {
  const plans = await getMonthlyPlans();
  return res.json({
    success: true,
    plan_horizon: "MONTHLY",
    count: plans.length,
    data: plans,
  });
}

/**
 * GET /api/v1/block-planning/weekly
 * Returns the 7-day operational refinement block plans.
 */
async function getWeekly(req, res) {
  const plans = await getWeeklyPlans();
  return res.json({
    success: true,
    plan_horizon: "WEEKLY",
    count: plans.length,
    data: plans,
  });
}

/**
 * POST /api/v1/block-planning/generate/monthly
 * Generates the 30-day strategic blueprint with resource requirements.
 */
async function generateMonthly(req, res) {
  const days = Number(req.body?.days) || 30;
  const maxDistanceKm = Number(req.body?.maxDistanceKm) || 2.0;
  const result = await generateMonthlyBlueprint({ days, maxDistanceKm });
  return res.status(200).json(result);
}

/**
 * POST /api/v1/block-planning/generate/weekly
 * Derives 7-day operational plan from monthly blueprint, detecting train conflicts
 * and re-optimizing with alternative windows.
 */
async function generateWeekly(req, res) {
  const days = Number(req.body?.days) || 7;
  const result = await generateWeeklyRefinement({ days });
  return res.status(200).json(result);
}

/**
 * POST /api/v1/block-planning/:id/approve
 * Official approval workflow (PROPOSED -> APPROVED).
 */
async function approvePlan(req, res) {
  const planId = req.params.id;
  try {
    const updated = await approvePlanService(planId);
    return res.json({
      success: true,
      message: `Block Plan #${planId} has been officially approved.`,
      data: updated,
    });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/v1/block-planning/:id/cancel
 * Official cancellation workflow (PROPOSED -> CANCELLED).
 */
async function cancelPlan(req, res) {
  const planId = req.params.id;
  const reason = req.body?.reason;
  try {
    const updated = await cancelPlanService(planId, reason);
    return res.json({
      success: true,
      message: `Block Plan #${planId} has been cancelled.`,
      data: updated,
    });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
}

module.exports = {
  optimize,
  getRawTasks,
  getWindows,
  clusterOnly,
  getMonthly,
  getWeekly,
  generateMonthly,
  generateWeekly,
  approvePlan,
  cancelPlan,
};


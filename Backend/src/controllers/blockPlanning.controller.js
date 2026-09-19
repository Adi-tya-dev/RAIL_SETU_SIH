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

module.exports = { optimize, getRawTasks, getWindows, clusterOnly };

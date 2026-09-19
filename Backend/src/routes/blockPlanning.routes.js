/**
 * blockPlanning.routes.js
 *
 * Routes for the ML Block Planning pipeline.
 * Mounted at: /api/v1/block-planning
 *
 * Endpoints:
 *   POST /optimize          — Full 2-stage pipeline (cluster + schedule)
 *   GET  /tasks             — Fetch normalized raw tasks from all 4 sources
 *   GET  /windows           — Fetch available COA maintenance windows
 *   POST /cluster-only      — Stage 1 only (spatial clustering preview)
 */

"use strict";

const express = require("express");
const ctrl = require("../controllers/blockPlanning.controller");

const router = express.Router();

// Full 2-stage ML pipeline
router.post("/optimize", ctrl.optimize);

// Stage 1 preview only (clustering without scheduling)
router.post("/cluster-only", ctrl.clusterOnly);

// Data inspection endpoints
router.get("/tasks", ctrl.getRawTasks);
router.get("/windows", ctrl.getWindows);

// Two-Horizon Planning Endpoints
router.get("/monthly", ctrl.getMonthly);
router.get("/weekly", ctrl.getWeekly);
router.post("/generate/monthly", ctrl.generateMonthly);
router.post("/generate/weekly", ctrl.generateWeekly);
router.post("/:id/approve", ctrl.approvePlan);
router.post("/:id/cancel", ctrl.cancelPlan);

module.exports = router;


/**
 * blockPlanning.routes.js
 *
 * Routes for the ML Block Planning pipeline.
 * Mounted at: /api/v1/block-planning
 *
 * Endpoints:
 *   POST /optimize          — Full 4-stage pipeline (cluster + ML score + schedule)
 *   GET  /tasks             — Fetch normalized raw tasks from all 4 sources
 *   GET  /windows           — Fetch available COA maintenance windows
 *   POST /cluster-only      — Stage 2 only (spatial clustering preview)
 *   GET  /monthly           — 30-day monthly blueprint
 *   GET  /weekly            — 7-day weekly operational plan
 *   POST /generate/monthly  — Generate monthly blueprint
 *   POST /generate/weekly   — Generate weekly plan
 *   POST /:id/approve       — Approve a plan
 *   POST /:id/cancel        — Cancel a plan
 */

"use strict";

const express = require("express");
const ctrl    = require("../controllers/blockPlanning.controller");

const router  = express.Router();

// Full 4-stage ML pipeline (Cluster → ML Score → CSP Optimize)
router.post("/optimize",     ctrl.optimize);
router.post("/cluster-only", ctrl.clusterOnly);

// Data inspection endpoints
router.get("/tasks",   ctrl.getRawTasks);
router.get("/windows", ctrl.getWindows);

// Two-Horizon Planning Endpoints
router.get("/monthly",           ctrl.getMonthly);
router.get("/weekly",            ctrl.getWeekly);
router.post("/generate/monthly", ctrl.generateMonthly);
router.post("/generate/weekly",  ctrl.generateWeekly);
router.post("/:id/approve",      ctrl.approvePlan);
router.post("/:id/cancel",       ctrl.cancelPlan);

module.exports = router;


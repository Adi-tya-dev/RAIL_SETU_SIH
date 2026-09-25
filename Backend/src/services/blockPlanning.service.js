/**
 * blockPlanning.service.js
 *
 * Orchestrates the full 4-stage AI/ML optimization pipeline:
 *
 *   Stage 1 — Fetch raw data from all 4 source APIs:
 *     TMS  (Track Maintenance System)       → Engineering tasks
 *     SMMS (Signalling & Telecom System)    → Signal tasks
 *     TDMS (Traction Distribution System)  → Traction/Electrical tasks
 *     COA  (Corridor Ops & Availability)   → Block windows + timetable
 *
 *   Stage 2 — Run Spatial Clustering:
 *     clusteringEngine.generateWorkPackages(rawTasks)
 *     → clusters tasks by physical proximity (2 km radius, DBSCAN-like)
 *
 *   Stage 2.5 — ML Priority Scoring (MCDM):
 *     mlScoring.scoreAndRankPackages(workPackages)
 *     → assigns each package a Smart Priority Index (SPI) via weighted
 *       multi-criteria feature normalization (urgency, criticality, deadline,
 *       time-savings, consolidation gain). Re-ranks the queue before CSP.
 *
 *   Stage 3 — Run Constraint Optimization (CSP):
 *     optimizationEngine.optimizeBlockSchedule(rankedPackages, coaWindows)
 *     → assigns packages to COA windows, enforces capacity & section constraints
 *
 *   Stage 4 — Return structured response with metrics
 */

"use strict";

const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { generateWorkPackages } = require("../algorithms/clusteringEngine");
const { optimizeBlockSchedule, computeOptimizationMetrics } = require("../algorithms/optimizationEngine");
const { scoreAndRankPackages, FEATURE_WEIGHTS } = require("../algorithms/mlScoring.engine");

const { TMS_CATALOG } = require("../integration/simulators/tms.simulator");
const { SMMS_CATALOG } = require("../integration/simulators/smms.simulator");
const { TDMS_CATALOG } = require("../integration/simulators/tdms.simulator");

const BLOCK_META = {
  B001: { start_km: 0, end_km: 15, section: "SEC-DLJP" },
  B002: { start_km: 15, end_km: 30, section: "SEC-DLJP" },
  B003: { start_km: 0, end_km: 20, section: "SEC-DLJP" },
  B004: { start_km: 0, end_km: 20, section: "SEC-DLAM" },
  B005: { start_km: 20, end_km: 45, section: "SEC-DLAM" },
  B006: { start_km: 45, end_km: 70, section: "SEC-DLAM" },
  B007: { start_km: 0, end_km: 25, section: "SEC-MBLK" },
  B008: { start_km: 25, end_km: 55, section: "SEC-MBLK" },
  B009: { start_km: 55, end_km: 85, section: "SEC-MBLK" },
  B010: { start_km: 0, end_km: 30, section: "SEC-BCAH" },
  B011: { start_km: 30, end_km: 60, section: "SEC-BCAH" },
  B012: { start_km: 0, end_km: 25, section: "SEC-DLAM" },
  B013: { start_km: 25, end_km: 50, section: "SEC-MBLK" },
  B014: { start_km: 0, end_km: 20, section: "SEC-BCPN" },
  B015: { start_km: 20, end_km: 40, section: "SEC-BCPN" },
};

function getFallbackTasks() {
  const all = [
    ...TMS_CATALOG.map((t) => ({ ...t, department: "ENGINEERING", source: "TMS" })),
    ...SMMS_CATALOG.map((t) => ({ ...t, department: "SIGNAL", source: "SMMS" })),
    ...TDMS_CATALOG.map((t) => ({ ...t, department: "TRACTION", source: "TDMS" })),
  ];
  return all.map((t, idx) => {
    const meta = BLOCK_META[t.blockCode] || { start_km: 5 + (idx % 5) * 5, end_km: 20 + (idx % 5) * 5, section: t.sectionCode || "SEC-DLJP" };
    return {
      id: String(idx + 1),
      external_ref: t.externalRef,
      department: t.department,
      maintenance_type: t.maintenanceType,
      description: t.description,
      source: t.source,
      priority: t.priority || 1,
      criticality: t.criticality || 1,
      urgency: t.urgency || 1,
      duration: Number(t.durationMinutes),
      duration_minutes: Number(t.durationMinutes),
      start_km: meta.start_km,
      block_start_chainage: meta.start_km,
      block_end_chainage: meta.end_km,
      block_code: t.blockCode,
      block_id: t.blockCode,
      section_code: t.sectionCode || meta.section,
      asset_code: t.assetCode,
      preferred_start: t.preferredStart,
      deadline: t.deadline,
      status: t.status || "APPROVED",
      category: t.category || "DEFECT",
    };
  });
}

function getFallbackWindows() {
  return [
    { id: "COA_WIN_01", duration_mins: 150, label: "09:00 AM – 11:30 AM (Sec SEC-DLJP, Block B001)", section_codes: ["SEC-DLJP"], block_code: "B001", source: "COA_SIMULATOR" },
    { id: "COA_WIN_02", duration_mins: 180, label: "12:00 PM – 03:00 PM (Sec SEC-DLAM, Block B004)", section_codes: ["SEC-DLAM"], block_code: "B004", source: "COA_SIMULATOR" },
    { id: "COA_WIN_03", duration_mins: 90,  label: "01:30 PM – 03:00 PM (Sec SEC-DLJP, Block B002)", section_codes: ["SEC-DLJP"], block_code: "B002", source: "COA_SIMULATOR" },
    { id: "COA_WIN_04", duration_mins: 240, label: "02:00 AM – 06:00 AM (Sec SEC-MBLK, Block B008)", section_codes: ["SEC-MBLK"], block_code: "B008", source: "COA_SIMULATOR" },
    { id: "COA_WIN_05", duration_mins: 180, label: "11:00 PM – 02:00 AM (Sec SEC-BCAH, Block B010)", section_codes: ["SEC-BCAH"], block_code: "B010", source: "COA_SIMULATOR" },
    { id: "COA_WIN_06", duration_mins: 120, label: "03:30 AM – 05:30 AM (Sec SEC-BCPN, Block B014)", section_codes: ["SEC-BCPN"], block_code: "B014", source: "COA_SIMULATOR" },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS: pull normalized task arrays from each source
// ──────────────────────────────────────────────────────────────────────────────

/**
 * fetchMaintenanceTasks
 *
 * Reads all PENDING/APPROVED maintenance tasks from the DB (already synced
 * from TMS, SMMS, TDMS via the integration layer) or falls back to the
 * simulated multi-system catalogs.
 */
async function fetchMaintenanceTasks() {
  try {
    const tasks = await prisma.maintenanceTask.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED", "IN_PROGRESS"] },
      },
      include: {
        asset: true,
        block: {
          include: { track: { include: { section: true } } },
        },
        section: true,
      },
      orderBy: { maintenance_task_id: "asc" },
    });

    if (tasks && tasks.length > 0) {
      return tasks.map((t) => {
        const blockCode = t.block ? t.block.block_code : (t.block_code || null);
        const meta = BLOCK_META[blockCode] || null;
        const bStart = t.block && t.block.start_chainage != null ? Number(t.block.start_chainage) : (meta ? meta.start_km : null);
        const bEnd = t.block && t.block.end_chainage != null ? Number(t.block.end_chainage) : (meta ? meta.end_km : null);
        const trueSec = (meta && meta.section)
          || (t.block && t.block.track && t.block.track.section ? t.block.track.section.section_code : null)
          || (t.section ? t.section.section_code : null);

        return {
          id: String(t.maintenance_task_id),
          external_ref: t.external_ref,
          department: t.department,
          maintenance_type: t.maintenance_type,
          description: t.description,
          source: t.source || "MANUAL",
          priority: t.priority || 1,
          criticality: t.criticality || 1,
          urgency: t.urgency || 1,
          duration: Number(t.duration_minutes),
          duration_minutes: Number(t.duration_minutes),
          start_km: bStart,
          end_km: bEnd,
          block_start_chainage: bStart,
          block_end_chainage: bEnd,
          block_code: blockCode,
          block_id: t.block_id ? String(t.block_id) : (blockCode || null),
          section_code: trueSec,
          asset_code: t.asset ? t.asset.asset_code : null,
          preferred_start: t.preferred_start,
          deadline: t.deadline,
          status: t.status,
          category: t.category || (String(t.urgency) === "4" ? "DEFECT" : "ROUTINE"),
        };
      });
    }
  } catch (err) {
    logger.warn(`[blockPlanning] DB task fetch skipped or failed: ${err.message}. Using simulated multi-source catalog.`);
  }

  return getFallbackTasks();
}

/**
 * fetchCoaWindows
 *
 * Reads COA-published maintenance time windows from the DB and unions with
 * high-fidelity COA daily availability and timetable gap windows.
 */
async function fetchCoaWindows() {
  const windows = [];

  // 1. Train movement gap windows from DB
  try {
    const blockMovements = await prisma.trainBlockMovement.findMany({
      include: { block: { include: { track: { include: { section: true } } } } },
      orderBy: [{ block_id: "asc" }, { scheduled_entry: "asc" }],
    });

    const byBlock = new Map();
    for (const mv of blockMovements) {
      const key = String(mv.block_id);
      if (!byBlock.has(key)) byBlock.set(key, { block: mv.block, movements: [] });
      byBlock.get(key).movements.push(mv);
    }

    for (const [blockId, { block, movements }] of byBlock) {
      const sorted = movements.sort(
        (a, b) => new Date(a.scheduled_entry) - new Date(b.scheduled_entry)
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const gapStart = new Date(sorted[i].scheduled_exit);
        const gapEnd = new Date(sorted[i + 1].scheduled_entry);
        const gapMins = (gapEnd - gapStart) / 60000;
        if (gapMins >= 30) {
          const sectionCode =
            block && block.track && block.track.section
              ? block.track.section.section_code
              : (BLOCK_META[block?.block_code]?.section || null);
          windows.push({
            id: `GAP_${blockId}_${i}`,
            duration_mins: Math.floor(gapMins),
            label: `${gapStart.toISOString().slice(11, 16)} – ${gapEnd.toISOString().slice(11, 16)} (${block ? block.block_code : "?"})`,
            section_codes: sectionCode ? [sectionCode] : [],
            block_code: block ? block.block_code : null,
            gap_start: gapStart.toISOString(),
            gap_end: gapEnd.toISOString(),
            source: "TRAIN_GAP",
          });
        }
      }
    }
  } catch (err) {
    logger.warn(`[blockPlanning] DB train gap fetch skipped: ${err.message}.`);
  }

  // 2. Official COA daily block maintenance availability from coaSimulator
  try {
    const { coaSimulator } = require("../integration/simulators/coa.simulator");
    const coaData = await coaSimulator.getData();
    if (coaData && Array.isArray(coaData.blocks)) {
      for (const b of coaData.blocks) {
        if (b.availability === "AVAILABLE" || b.status === "AVAILABLE") {
          const sectionCode = b.section_code || (BLOCK_META[b.block_code]?.section || "SEC-DLJP");
          windows.push({
            id: `COA_AVAIL_${b.block_code}`,
            duration_mins: 360, // Standard 6-hour daily corridor maintenance slot
            label: `COA Maintenance Slot (Block ${b.block_code}, ${sectionCode})`,
            section_codes: [sectionCode],
            block_code: b.block_code,
            is_corridor_window: true,
            is_section_window: true,
            source: "COA_BLOCK_AVAILABILITY",
          });
        }
      }
    }
  } catch (err) {
    logger.warn(`[blockPlanning] COA simulator window fetch skipped: ${err.message}`);
  }

  if (windows.length > 0) return windows;
  return getFallbackWindows();
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * runBlockPlanningPipeline
 *
 * Executes the full 2-stage ML pipeline end-to-end and returns the result.
 *
 * @param {Object} options
 * @param {number} [options.maxDistanceKm=2.0]  - Clustering radius
 * @returns {Object}                             - Pipeline result
 */
async function runBlockPlanningPipeline({ maxDistanceKm = 2.0 } = {}) {
  const startedAt = Date.now();

  // ── Stage 1: Fetch raw data from all 4 source APIs ─────────────────────────
  logger.info("[blockPlanning] Stage 1: Fetching data from TMS, SMMS, TDMS, COA sources...");
  const [rawTasks, coaWindows] = await Promise.all([
    fetchMaintenanceTasks(),
    fetchCoaWindows(),
  ]);

  logger.info(`[blockPlanning] Fetched ${rawTasks.length} maintenance tasks, ${coaWindows.length} COA windows`);

  // ── Stage 2: Spatial Clustering (DBSCAN-like, 1D proximity) ───────────────
  logger.info(`[blockPlanning] Stage 2: Running Spatial Clustering (radius=${maxDistanceKm} km)...`);
  const workPackages = generateWorkPackages(rawTasks, maxDistanceKm);
  logger.info(`[blockPlanning] Clustering produced ${workPackages.length} Work Packages from ${rawTasks.length} tasks`);

  // ── Stage 2.5: ML Priority Scoring (Weighted MCDM) ─────────────────────────
  // Applies min-max normalized, weighted Multi-Criteria Decision Model scoring.
  // Each package receives an ml_priority_index (SPI) and ml_feature_vector.
  // Re-ranks the queue before it enters the CSP optimizer — this ensures the
  // greedy assignment loop processes the highest-value packages first.
  logger.info("[blockPlanning] Stage 2.5: Running ML Priority Scoring (MCDM normalization)...");
  const rankedPackages = scoreAndRankPackages(workPackages);
  const emergencyCount = rankedPackages.filter((p) => p.has_emergency).length;
  const topPackage = rankedPackages[0];
  logger.info(
    `[blockPlanning] ML Scoring complete: top package=${topPackage ? topPackage.package_id : "none"} ` +
    `(SPI=${topPackage ? topPackage.ml_priority_index : "N/A"}), ` +
    `emergency_packages=${emergencyCount}`
  );

  // ── Stage 3: Constraint Satisfaction Problem (CSP) Solver ──────────────────
  logger.info("[blockPlanning] Stage 3: Running Constraint Optimization Scheduler...");
  const schedule = optimizeBlockSchedule(rankedPackages, coaWindows);

  // ── Stage 4: Compute metrics ────────────────────────────────────────────────
  const metrics = computeOptimizationMetrics(schedule, rankedPackages, coaWindows);
  const durationMs = Date.now() - startedAt;

  logger.info(
    `[blockPlanning] Pipeline complete in ${durationMs}ms: ` +
    `${metrics.assigned_packages}/${metrics.total_packages} packages assigned, ` +
    `efficiency=${metrics.efficiency_rate}`
  );

  return {
    success: true,
    pipeline: {
      stages: ["FETCH_SOURCES", "SPATIAL_CLUSTERING", "ML_PRIORITY_SCORING", "CONSTRAINT_OPTIMIZATION"],
      clustering_radius_km: maxDistanceKm,
      duration_ms: durationMs,
    },
    data_summary: {
      raw_tasks_fetched: rawTasks.length,
      coa_windows_available: coaWindows.length,
      work_packages_generated: schedule.length,
      initial_clusters_generated: workPackages.length,
    },
    ml_scoring_summary: {
      model: "Weighted MCDM (Multi-Criteria Decision Model)",
      normalization: "Min-Max across batch",
      feature_weights: FEATURE_WEIGHTS,
      top_ranked_package: topPackage ? {
        package_id: topPackage.package_id,
        ml_priority_index: topPackage.ml_priority_index,
        ml_feature_vector: topPackage.ml_feature_vector,
        has_emergency: topPackage.has_emergency,
      } : null,
      emergency_packages_count: emergencyCount,
    },
    optimization_metrics: metrics,
    work_packages: rankedPackages,
    schedules: schedule,
    coa_windows: coaWindows,
  };
}

module.exports = { runBlockPlanningPipeline, fetchMaintenanceTasks, fetchCoaWindows };

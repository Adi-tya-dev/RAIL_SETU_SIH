/**
 * clusteringEngine.js — Stage 1: AI/ML Spatial Clustering
 *
 * Implements Density-Based Proximity Clustering for railway maintenance tasks.
 * Takes raw tasks from TMS, SMMS, TDMS (and any COA-linked maintenance tasks)
 * and groups tasks within maxDistanceKm of each other into unified Work Packages.
 *
 * Algorithm:
 *   1. Sort tasks by physical track location (start_km / block chainage)
 *   2. Slide a proximity window: tasks within 2 km become one cluster
 *   3. Aggregate cluster → Work Package (departments, total duration = MAX duration
 *      because crews work simultaneously)
 *
 * Input shape (per task):
 *   { id, department, start_km, duration, urgency, priority, criticality,
 *     block_code, section_code, external_ref, maintenance_type, description,
 *     preferred_start, deadline, status }
 *
 * Output shape (per Work Package):
 *   { package_id, description, departments_involved, tasks_clubbed,
 *     km_span, total_duration_required, tasks, priority_score,
 *     has_emergency, block_codes, section_code }
 */

"use strict";

const DEFAULT_MAX_DISTANCE_KM = 2.0;

/**
 * Compute a composite priority score for a cluster of tasks.
 * Uses the same weighting as the existing scheduling engine:
 *   weight = priority*3 + criticality*2 + urgency*2
 * Returns the maximum weight task's score, representative of cluster urgency.
 */
function clusterPriorityScore(tasks) {
  return tasks.reduce((max, t) => {
    const w = (t.priority || 1) * 3 + (t.criticality || 1) * 2 + (t.urgency || 1) * 2;
    return Math.max(max, w);
  }, 0);
}

/**
 * Extract a numeric km value from a task.
 * Tries start_km first (explicit), then falls back to block chainage data.
 */
function resolveKm(task) {
  if (task.start_km != null && !Number.isNaN(Number(task.start_km))) {
    return Number(task.start_km);
  }
  // Fallback: use block start_chainage if available
  if (task.block_start_chainage != null) {
    return Number(task.block_start_chainage);
  }
  // No position data — assign to end so it doesn't disrupt real clusters
  return Infinity;
}

/**
 * generateWorkPackages
 *
 * @param {Array}  tasks          - Normalized task array (from all 4 sources)
 * @param {number} maxDistanceKm  - Cluster radius in kilometres (default 2.0)
 * @returns {Array}               - Work Package array
 */
function generateWorkPackages(tasks, maxDistanceKm = DEFAULT_MAX_DISTANCE_KM) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  // -----------------------------------------------------------------
  // Step 1: Sort tasks by physical track location (km)
  // -----------------------------------------------------------------
  const sortedTasks = [...tasks].sort((a, b) => resolveKm(a) - resolveKm(b));

  // -----------------------------------------------------------------
  // Step 2: Proximity sweep — build clusters
  // -----------------------------------------------------------------
  const packages = [];
  let currentCluster = [];

  for (let i = 0; i < sortedTasks.length; i++) {
    if (currentCluster.length === 0) {
      currentCluster.push(sortedTasks[i]);
    } else {
      // Distance check: compare against the FIRST task in the cluster
      const referenceTask = currentCluster[0];
      const refKm = resolveKm(referenceTask);
      const curKm = resolveKm(sortedTasks[i]);
      const distance = Math.abs(curKm - refKm);

      if (refKm === Infinity || curKm === Infinity) {
        // Tasks without position go into their own packages
        packages.push(currentCluster);
        currentCluster = [sortedTasks[i]];
      } else if (distance <= maxDistanceKm) {
        // Within proximity — club into same package
        currentCluster.push(sortedTasks[i]);
      } else {
        // Distance exceeded — close current cluster, start new one
        packages.push(currentCluster);
        currentCluster = [sortedTasks[i]];
      }
    }
  }
  if (currentCluster.length > 0) packages.push(currentCluster);

  // -----------------------------------------------------------------
  // Step 3: Aggregate each cluster into a structured Work Package
  // -----------------------------------------------------------------
  return packages.map((cluster, index) => {
    const kms = cluster
      .map(resolveKm)
      .filter((k) => k !== Infinity);

    const minKm = kms.length > 0 ? Math.min(...kms) : null;
    const maxKm = kms.length > 0 ? Math.max(...kms) : null;
    const kmSpan = minKm != null && maxKm != null
      ? `${minKm.toFixed(3)} to ${maxKm.toFixed(3)}`
      : "UNKNOWN";

    const departmentsInvolved = [...new Set(cluster.map((t) => t.department).filter(Boolean))];
    const blockCodes = [...new Set(cluster.map((t) => t.block_code).filter(Boolean))];
    const sectionCodes = [...new Set(cluster.map((t) => t.section_code).filter(Boolean))];

    // CRITICAL: Total duration = MAX task duration because all crews work simultaneously.
    // Adding a 15-min coordination buffer per additional department.
    const maxDuration = Math.max(...cluster.map((t) => Number(t.duration) || Number(t.duration_minutes) || 0));
    const coordinationBuffer = 15 * Math.max(0, departmentsInvolved.length - 1);
    const totalDurationRequired = maxDuration + coordinationBuffer;

    const hasEmergency = cluster.some((t) =>
      String(t.urgency) === "4" ||
      String(t.category || "").toUpperCase() === "DEFECT" ||
      String(t.maintenance_type || "").includes("EMERGENCY")
    );

    const priorityScore = clusterPriorityScore(cluster);

    // Earliest deadline across the cluster (null if none)
    const deadlines = cluster
      .map((t) => t.deadline)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));
    const earliestDeadline = deadlines.length > 0
      ? new Date(Math.min(...deadlines)).toISOString()
      : null;

    // Earliest preferred start
    const prefStarts = cluster
      .map((t) => t.preferred_start)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));
    const earliestPreferredStart = prefStarts.length > 0
      ? new Date(Math.min(...prefStarts)).toISOString()
      : null;

    const description =
      `Clubbed Operations [${departmentsInvolved.join(", ")}]` +
      (blockCodes.length > 0 ? ` — Blocks: ${blockCodes.join(", ")}` : "");

    const rawDurationSum = cluster.reduce(
      (sum, t) => sum + (Number(t.duration) || Number(t.duration_minutes) || 0),
      0
    );
    const timeSavedMins = Math.max(0, rawDurationSum - totalDurationRequired);

    return {
      package_id: `PKG_${index + 1}`,
      description,
      departments_involved: departmentsInvolved,
      tasks_clubbed: cluster.map((t) => ({ id: t.id, department: t.department })),
      tasks: cluster.map((t) => ({
        id: String(t.id),
        external_ref: t.external_ref,
        department: t.department,
        maintenance_type: t.maintenance_type,
        description: t.description,
        duration_minutes: Number(t.duration) || Number(t.duration_minutes) || 0,
        priority: t.priority || 1,
        criticality: t.criticality || 1,
        urgency: t.urgency || 1,
        block_code: t.block_code,
        section_code: t.section_code,
        asset_code: t.asset_code,
        start_km: t.start_km,
        deadline: t.deadline,
        preferred_start: t.preferred_start,
      })),
      task_count: cluster.length,
      block_codes: blockCodes,
      section_codes: sectionCodes,
      km_span: kmSpan,
      km_min: minKm,
      km_max: maxKm,
      total_duration_required: totalDurationRequired,
      raw_duration_sum: rawDurationSum,
      time_saved_mins: timeSavedMins,
      max_single_task_duration: maxDuration,
      coordination_buffer_mins: coordinationBuffer,
      priority_score: priorityScore,
      has_emergency: hasEmergency,
      earliest_deadline: earliestDeadline,
      earliest_preferred_start: earliestPreferredStart,
    };
  });
}

module.exports = { generateWorkPackages };

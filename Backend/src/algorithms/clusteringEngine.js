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
/**
 * resolveRouteKm
 *
 * Resolves the absolute physical track coordinate (in km) measured in the
 * forward direction from the section's deadpoint (Origin / KP 0.000).
 *
 * Handles:
 * 1. Global Continuous Route Chainage (e.g. 14.5 km in Block 1, 15.5 km in Block 2)
 * 2. Block-Local Relative Offsets (e.g. 0.5 km inside Block 2 where Block 2 starts at 15.0 km -> resolves to 15.5 km)
 * 3. Textual extraction from description or asset name (e.g. "B001-KM5" -> 5.0 km, "2.4 km" -> 2.4 km)
 * 4. Fallback: Block start chainage
 */
function resolveRouteKm(task) {
  const bStart = task.block_start_chainage != null ? Number(task.block_start_chainage) : null;
  const bEnd = task.block_end_chainage != null ? Number(task.block_end_chainage) : null;

  // 1. If explicit numeric start_km is given
  if (task.start_km != null && !Number.isNaN(Number(task.start_km))) {
    const rawKm = Number(task.start_km);
    if (bStart != null && bEnd != null && bEnd > bStart) {
      // Case A: Absolute route chainage within/near block boundary
      if (rawKm >= bStart && rawKm <= bEnd) {
        return rawKm;
      }
      // Case B: Relative block offset: 0 <= rawKm <= blockLength, and block starts > 0
      const blockLen = bEnd - bStart;
      if (rawKm >= 0 && rawKm <= blockLen && bStart > 0) {
        return bStart + rawKm; // normalize to continuous forward chainage from deadpoint
      }
    }
    return rawKm;
  }

  // 2. Extract kilometer from description or asset code if present
  const desc = `${task.description || ""} ${task.asset_code || ""}`;
  const kmMatch = desc.match(/(?:KM|km)\s*[-:]?\s*(\d+(?:\.\d+)?)/i) || desc.match(/(\d+(?:\.\d+)?)\s*(?:KM|km)/i);
  if (kmMatch) {
    const parsedKm = parseFloat(kmMatch[1]);
    if (!Number.isNaN(parsedKm)) {
      if (bStart != null && bEnd != null && bEnd > bStart) {
        if (parsedKm >= bStart && parsedKm <= bEnd) return parsedKm;
        const blockLen = bEnd - bStart;
        if (parsedKm >= 0 && parsedKm <= blockLen && bStart > 0) return bStart + parsedKm;
      }
      return parsedKm;
    }
  }

  // 3. Fallback: block start chainage
  if (bStart != null) return bStart;

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
  // Step 1: Partition tasks by section/corridor.
  // Real-world rule: Tasks on different geographical sections (e.g.
  // Delhi-Jaipur vs Mumbai-Ahmedabad) must NEVER be clustered together.
  // -----------------------------------------------------------------
  const sectionMap = new Map();
  for (const t of tasks) {
    const sec = t.section_code || "GENERIC";
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec).push(t);
  }

  const rawClusters = [];

  // -----------------------------------------------------------------
  // Step 2: For each corridor, sort by forward chainage from deadpoint
  // and run proximity sweep (adjacent blocks allowed if within radius).
  // -----------------------------------------------------------------
  for (const [, secTasks] of sectionMap.entries()) {
    const enrichedTasks = secTasks.map((t) => ({
      ...t,
      _resolvedKm: resolveRouteKm(t),
    }));

    // Sort strictly by forward route chainage: 0 -> 14.5 -> 15.5 -> 30...
    enrichedTasks.sort((a, b) => a._resolvedKm - b._resolvedKm);

    let currentCluster = [];

    for (let i = 0; i < enrichedTasks.length; i++) {
      const cur = enrichedTasks[i];
      if (currentCluster.length === 0) {
        currentCluster.push(cur);
      } else {
        const refTask = currentCluster[0];
        const refKm = refTask._resolvedKm;
        const curKm = cur._resolvedKm;
        const distance = Math.abs(curKm - refKm);

        if (refKm === Infinity || curKm === Infinity) {
          // Unpositioned tasks form their own isolated packages
          rawClusters.push(currentCluster);
          currentCluster = [cur];
        } else if (distance <= maxDistanceKm) {
          // Within proximity window (e.g. 14.5 km in Block 1 and 15.5 km in Block 2:
          // distance is 1.0 km <= 2.0 km -> successfully clubbed into single slot)
          currentCluster.push(cur);
        } else {
          // Distance threshold exceeded -> close cluster, start new one
          rawClusters.push(currentCluster);
          currentCluster = [cur];
        }
      }
    }

    if (currentCluster.length > 0) {
      rawClusters.push(currentCluster);
    }
  }

  // -----------------------------------------------------------------
  // Step 3: Aggregate each cluster into a structured Work Package
  // -----------------------------------------------------------------
  return rawClusters.map((cluster, index) => {
    const resolvedKms = cluster
      .map((t) => t._resolvedKm)
      .filter((k) => k != null && k !== Infinity && !Number.isNaN(k));

    const minKm = resolvedKms.length > 0 ? Math.min(...resolvedKms) : null;
    const maxKm = resolvedKms.length > 0 ? Math.max(...resolvedKms) : null;

    let kmSpan;
    if (minKm == null || maxKm == null) {
      kmSpan = "UNKNOWN";
    } else if (maxKm > minKm) {
      const lengthKm = (maxKm - minKm).toFixed(1);
      kmSpan = `${minKm.toFixed(3)} to ${maxKm.toFixed(3)} (${lengthKm} km)`;
    } else {
      kmSpan = `${minKm.toFixed(3)} (Spot Task)`;
    }

    const departmentsInvolved = [...new Set(cluster.map((t) => t.department).filter(Boolean))];
    const blockCodes = [...new Set(cluster.map((t) => t.block_code).filter(Boolean))];
    const sectionCodes = [...new Set(cluster.map((t) => t.section_code).filter(Boolean))];
    const isMultiBlock = blockCodes.length > 1;

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

    const description = isMultiBlock
      ? `Clubbed Operations [${departmentsInvolved.join(", ")}] — Multi-Block Corridor: ${blockCodes.join(" + ")}`
      : `Clubbed Operations [${departmentsInvolved.join(", ")}]` +
        (blockCodes.length > 0 ? ` — Block: ${blockCodes[0]}` : "");

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
        start_km: t._resolvedKm != null && t._resolvedKm !== Infinity ? t._resolvedKm : t.start_km,
        deadline: t.deadline,
        preferred_start: t.preferred_start,
      })),
      task_count: cluster.length,
      block_codes: blockCodes,
      section_codes: sectionCodes,
      is_multi_block: isMultiBlock,
      requires_joint_possession: isMultiBlock,
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

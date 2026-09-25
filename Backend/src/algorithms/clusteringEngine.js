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

const DEPOT_REGISTRY = {
  "SEC-DLJP": { name: "Delhi Central P-Way & Track Machine Depot", depot_km: 0.0 },
  "SEC-DLAM": { name: "Ambala Divisional Machine Siding", depot_km: 20.0 },
  "SEC-MBLK": { name: "Moradabad Yard Track Machine Depot", depot_km: 25.0 },
  "SEC-BCAH": { name: "Ahmedabad Central P-Way Depot", depot_km: 30.0 },
  "SEC-BCPN": { name: "Pune Traction & Track Machine Depot", depot_km: 20.0 },
};

/**
 * calculateMachineTransit
 *
 * Implements Machine Mobilization & Travel Dead-Time formula:
 * T_transit = 2 * (|Depot KM - Work Site KM| / Machine Speed) * 60
 */
function calculateMachineTransit(cluster, sectionCode, siteKm) {
  const descriptions = cluster
    .map((t) => `${t.description || ""} ${t.maintenance_type || ""}`)
    .join(" ")
    .toLowerCase();

  let machine = null;
  if (
    descriptions.includes("tamp") ||
    descriptions.includes("track machine") ||
    descriptions.includes("geometry") ||
    descriptions.includes("sleeper") ||
    descriptions.includes("rail renewal") ||
    descriptions.includes("ballast")
  ) {
    machine = {
      type: "TRACK_MACHINE",
      name: "CSM Continuous Tamping Machine",
      speed: 35, // km/h restricted machine speed
      setup_mins: 15,
    };
  } else if (
    descriptions.includes("ohe") ||
    descriptions.includes("mast") ||
    descriptions.includes("dropper") ||
    descriptions.includes("catenary") ||
    descriptions.includes("pantograph") ||
    descriptions.includes("traction")
  ) {
    machine = {
      type: "TOWER_WAGON",
      name: "8-Wheeler Self-Propelled OHE Tower Car",
      speed: 40,
      setup_mins: 15, // permit-to-work and discharge rod hook-up
    };
  } else if (
    descriptions.includes("interlocking") ||
    descriptions.includes("point machine") ||
    descriptions.includes("cable") ||
    descriptions.includes("relay")
  ) {
    machine = {
      type: "SIGNAL_VAN",
      name: "S&T Mobile Testing & Wiring Van",
      speed: 45,
      setup_mins: 10,
    };
  }

  const depot = DEPOT_REGISTRY[sectionCode] || { name: "Divisional Track Machine Depot", depot_km: 0.0 };

  if (!machine) {
    return {
      machine_required: false,
      machine_name: "Manual Section Gang",
      depot_name: "Local Gang Chawki",
      depot_km: siteKm != null ? siteKm : 0.0,
      transit_distance_km: 0,
      transit_mins: 0,
      t_setup_mins: 10,
    };
  }

  const targetKm = siteKm != null && !Number.isNaN(siteKm) ? siteKm : depot.depot_km;
  const oneWayDistanceKm = Math.abs(targetKm - depot.depot_km);
  const roundTripDistanceKm = Number((oneWayDistanceKm * 2).toFixed(1));
  const rawTransitMins = Math.round((roundTripDistanceKm / machine.speed) * 60);
  const transitMins = Math.max(10, Math.min(35, rawTransitMins));

  return {
    machine_required: true,
    machine_name: machine.name,
    depot_name: depot.name,
    depot_km: depot.depot_km,
    transit_distance_km: roundTripDistanceKm,
    transit_mins: transitMins,
    t_setup_mins: machine.setup_mins,
  };
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
          // -------------------------------------------------------------
          // GUARD: Asymmetric Urgency & "Poisonous Clubbing" Protection
          // Prevent a heavy routine task (e.g. 240 mins) from inflating an
          // urgent/emergency task (e.g. 60 mins), which would cause the
          // urgent task to lose daytime slot eligibility.
          // -------------------------------------------------------------
          const clusterHasUrgent = currentCluster.some(
            (t) => Number(t.urgency) >= 3 || String(t.category || "").toUpperCase() === "DEFECT"
          );
          const curIsRoutine = Number(cur.urgency || 1) <= 2;
          const curDuration = Number(cur.duration) || Number(cur.duration_minutes) || 0;
          const clusterMaxDuration = Math.max(
            ...currentCluster.map((t) => Number(t.duration) || Number(t.duration_minutes) || 0)
          );

          if (clusterHasUrgent && curIsRoutine && curDuration > 180 && curDuration > clusterMaxDuration * 1.4) {
            // Decouple routine task: keep urgent cluster lean and immediately slottable
            rawClusters.push(currentCluster);
            currentCluster = [cur];
          } else {
            currentCluster.push(cur);
          }
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

    // Physical block boundaries
    const blockStarts = cluster
      .map((t) => (t.block_start_chainage != null ? Number(t.block_start_chainage) : null))
      .filter((k) => k != null && !Number.isNaN(k));
    const blockEnds = cluster
      .map((t) => (t.block_end_chainage != null ? Number(t.block_end_chainage) : null))
      .filter((k) => k != null && !Number.isNaN(k));

    const bMin = blockStarts.length > 0 ? Math.min(...blockStarts) : minKm;
    const bMax = blockEnds.length > 0 ? Math.max(...blockEnds) : maxKm;
    const blockLengthKm = (bMin != null && bMax != null && bMax >= bMin) ? Number((bMax - bMin).toFixed(1)) : null;

    let workSpanKm = 0;
    let kmSpan = "";
    let rangeLabel = "";
    let distanceLabel = "";
    let startKmVal = minKm != null ? minKm : bMin;
    let endKmVal = maxKm != null ? maxKm : bMax;

    if (minKm != null && maxKm != null && maxKm > minKm) {
      workSpanKm = Number((maxKm - minKm).toFixed(2));
      kmSpan = `Km ${minKm.toFixed(1)} to Km ${maxKm.toFixed(1)} (${workSpanKm} km work stretch)`;
      rangeLabel = `Km ${minKm.toFixed(1)} – ${maxKm.toFixed(1)}`;
      distanceLabel = `${workSpanKm} km stretch`;
      startKmVal = minKm;
      endKmVal = maxKm;
    } else if (bMin != null && bMax != null && bMax > bMin) {
      workSpanKm = blockLengthKm;
      kmSpan = `Km ${bMin.toFixed(1)} to Km ${bMax.toFixed(1)} (${blockLengthKm} km block corridor)`;
      rangeLabel = `Km ${bMin.toFixed(1)} – ${bMax.toFixed(1)}`;
      distanceLabel = `${blockLengthKm} km block corridor`;
      startKmVal = bMin;
      endKmVal = bMax;
    } else if (minKm != null) {
      kmSpan = `Km ${minKm.toFixed(3)} (Spot Location)`;
      rangeLabel = `Km ${minKm.toFixed(3)}`;
      distanceLabel = `Spot Repair (< 100m)`;
      startKmVal = minKm;
      endKmVal = minKm;
    } else {
      kmSpan = "Corridor Location Pending";
      rangeLabel = "Unspecified";
      distanceLabel = "—";
    }

    const departmentsInvolved = [...new Set(cluster.map((t) => t.department).filter(Boolean))];
    const blockCodes = [...new Set(cluster.map((t) => t.block_code).filter(Boolean))];
    const sectionCodes = [...new Set(cluster.map((t) => t.section_code).filter(Boolean))];
    const isMultiBlock = blockCodes.length > 1;

    // CRITICAL: Total duration = MAX task duration because all crews work simultaneously.
    // Adding coordination buffer + machine mobilization transit dead-time (T_transit).
    const maxDuration = Math.max(...cluster.map((t) => Number(t.duration) || Number(t.duration_minutes) || 0));
    const coordinationBuffer = 15 * Math.max(0, departmentsInvolved.length - 1);
    const transitInfo = calculateMachineTransit(cluster, sectionCodes[0], startKmVal);
    const wrenchDuration = maxDuration;
    const totalDurationRequired = wrenchDuration + coordinationBuffer + (transitInfo.transit_mins || 0);

    const hasEmergency = cluster.some((t) =>
      String(t.urgency) === "4" ||
      String(t.category || "").toUpperCase() === "EMERGENCY" ||
      String(t.maintenance_type || "").toUpperCase().includes("EMERGENCY") ||
      String(t.description || "").toUpperCase().includes("EMERGENCY")
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
    // -----------------------------------------------------------------
    // Slack-Aware Early Execution & 2-Day Safety Buffer calculations
    // -----------------------------------------------------------------
    const nowMs = Date.now();
    const taskDates = cluster
      .map((t) => t.preferred_start || t.requested_at)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((d) => !Number.isNaN(d));
    // Support both live timestamps and dataset planning dates
    const planningBaselineMs = (taskDates.length > 0 && Math.min(...taskDates) < nowMs)
      ? Math.min(...taskDates)
      : nowMs;

    const SAFETY_BUFFER_DAYS = 2;
    const SAFETY_BUFFER_MS = SAFETY_BUFFER_DAYS * 24 * 60 * 60 * 1000;
    let minSlackDays = null;
    let isPullForwardCandidate = false;

    if (earliestDeadline) {
      const deadlineMs = new Date(earliestDeadline).getTime();
      if (!Number.isNaN(deadlineMs)) {
        const diffMs = deadlineMs - planningBaselineMs;
        minSlackDays = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
        // If deadline is comfortably in the future (> 2 days buffer)
        if (diffMs > SAFETY_BUFFER_MS) {
          isPullForwardCandidate = true;
        }
      }
    }

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
      range_label: rangeLabel,
      distance_label: distanceLabel,
      start_km: startKmVal,
      end_km: endKmVal,
      span_km: workSpanKm,
      km_min: minKm,
      km_max: maxKm,
      total_duration_required: totalDurationRequired,
      wrench_duration_mins: wrenchDuration,
      coordination_buffer_mins: coordinationBuffer,
      transit_mins: transitInfo.transit_mins || 0,
      t_setup_mins: transitInfo.t_setup_mins || 10,
      machine_required: transitInfo.machine_required,
      machine_name: transitInfo.machine_name,
      depot_name: transitInfo.depot_name,
      depot_km: transitInfo.depot_km,
      transit_distance_km: transitInfo.transit_distance_km,
      raw_duration_sum: rawDurationSum,
      time_saved_mins: timeSavedMins,
      max_single_task_duration: maxDuration,
      priority_score: priorityScore,
      has_emergency: hasEmergency,
      earliest_deadline: earliestDeadline,
      earliest_preferred_start: earliestPreferredStart,
      slack_days: minSlackDays,
      safety_buffer_days: SAFETY_BUFFER_DAYS,
      is_pull_forward_candidate: isPullForwardCandidate,
    };
  });
}

module.exports = { generateWorkPackages };

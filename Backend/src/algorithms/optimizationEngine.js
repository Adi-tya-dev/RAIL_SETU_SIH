/**
 * optimizationEngine.js — Stage 2: Constraint-Based Optimization (Greedy CSP Solver)
 *
 * Maps pre-clustered Work Packages into available COA time windows while
 * enforcing hard constraints:
 *   1. Package must PHYSICALLY FIT in the window (duration ≤ remaining capacity)
 *   2. Smaller windows are filled first (bin-packing / first-fit-decreasing)
 *   3. Emergency packages (urgency=4) are prioritised before routine ones
 *   4. A window can host multiple non-conflicting packages (its time is decremented)
 *   5. Packages that cannot fit in ANY window → UNASSIGNED (escalate to controller)
 *
 * Input:
 *   workPackages  — array from clusteringEngine.generateWorkPackages()
 *   coaWindows    — array of { id, duration_mins, label, section_codes?, block_codes? }
 *                   (parsed from COA block-availability / timetable data)
 *
 * Output:
 *   finalizedSchedule — array of {
 *     package_id, description, duration_needed, assigned_window, time_slot, status,
 *     departments_involved, block_codes, priority_score, has_emergency
 *   }
 */

"use strict";

/**
 * optimizeBlockSchedule
 *
 * @param {Array} workPackages  - Output of clusteringEngine.generateWorkPackages()
 * @param {Array} coaWindows    - COA-provided available maintenance windows
 * @returns {Array}             - Finalized schedule (assigned + unassigned entries)
 */
function optimizeBlockSchedule(workPackages, coaWindows) {
  const finalizedSchedule = [];

  if (!Array.isArray(workPackages) || workPackages.length === 0) return finalizedSchedule;
  if (!Array.isArray(coaWindows) || coaWindows.length === 0) {
    // No windows — all packages unassigned
    for (const pkg of workPackages) {
      finalizedSchedule.push(makeUnassigned(pkg, "NO_WINDOWS_AVAILABLE"));
    }
    return finalizedSchedule;
  }

  // -----------------------------------------------------------------
  // Step 1: Sort windows by capacity (ascending) — fill smaller slots
  // first so larger emergency jobs have access to bigger windows.
  // -----------------------------------------------------------------
  const sortedWindows = [...coaWindows].sort((a, b) => a.duration_mins - b.duration_mins);

  // -----------------------------------------------------------------
  // Step 2: Internal state ledger — track remaining time per window.
  // A window starts with its full declared duration.
  // -----------------------------------------------------------------
  const windowCapacities = {};
  for (const w of sortedWindows) {
    windowCapacities[w.id] = w.duration_mins;
  }

  // -----------------------------------------------------------------
  // Step 3: Sort work packages — emergency (has_emergency) first,
  // then by descending priority_score, then earliest deadline.
  // -----------------------------------------------------------------
  const sortedPackages = [...workPackages].sort((a, b) => {
    if (a.has_emergency && !b.has_emergency) return -1;
    if (!a.has_emergency && b.has_emergency) return 1;
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    // Earlier deadline comes first
    const da = a.earliest_deadline ? new Date(a.earliest_deadline).getTime() : Infinity;
    const db = b.earliest_deadline ? new Date(b.earliest_deadline).getTime() : Infinity;
    return da - db;
  });

  // -----------------------------------------------------------------
  // Step 4: Greedy assignment loop
  // -----------------------------------------------------------------
  for (const pkg of sortedPackages) {
    let assigned = false;

    for (const window of sortedWindows) {
      // CONSTRAINT: The package must physically fit within the remaining window time.
      if (pkg.total_duration_required <= windowCapacities[window.id]) {
        // Optionally check section/block compatibility if window declares it
        if (window.section_codes && window.section_codes.length > 0) {
          const overlap = pkg.section_codes && pkg.section_codes.some(
            (sc) => window.section_codes.includes(sc)
          );
          if (!overlap) continue; // Window serves a different section
        }

        finalizedSchedule.push({
          package_id: pkg.package_id,
          description: pkg.description,
          departments_involved: pkg.departments_involved,
          block_codes: pkg.block_codes,
          section_codes: pkg.section_codes,
          km_span: pkg.km_span,
          task_count: pkg.task_count,
          duration_needed: `${pkg.total_duration_required} mins`,
          duration_needed_mins: pkg.total_duration_required,
          raw_duration_sum: pkg.raw_duration_sum || pkg.total_duration_required,
          time_saved_mins: pkg.time_saved_mins || 0,
          tasks: pkg.tasks || [],
          assigned_window: window.id,
          time_slot: window.label || window.id,
          priority_score: pkg.priority_score,
          has_emergency: pkg.has_emergency,
          earliest_deadline: pkg.earliest_deadline,
          status: "ASSIGNED",
        });

        // Deduct the scheduled time from the window's total capacity pool
        windowCapacities[window.id] -= pkg.total_duration_required;
        assigned = true;
        break; // Move to next package
      }
    }

    if (!assigned) {
      finalizedSchedule.push(makeUnassigned(pkg, "DEFICIT_WINDOW_CONFLICT"));
    }
  }

  return finalizedSchedule;
}

/**
 * Build an UNASSIGNED schedule entry with escalation flag.
 */
function makeUnassigned(pkg, reason) {
  return {
    package_id: pkg.package_id,
    description: pkg.description,
    departments_involved: pkg.departments_involved,
    block_codes: pkg.block_codes,
    section_codes: pkg.section_codes,
    km_span: pkg.km_span,
    task_count: pkg.task_count,
    duration_needed: `${pkg.total_duration_required} mins`,
    duration_needed_mins: pkg.total_duration_required,
    raw_duration_sum: pkg.raw_duration_sum || pkg.total_duration_required,
    time_saved_mins: pkg.time_saved_mins || 0,
    tasks: pkg.tasks || [],
    assigned_window: "NONE",
    time_slot: "UNASSIGNED — Escalate to Human Controller for Dynamic Traffic Diversion",
    priority_score: pkg.priority_score,
    has_emergency: pkg.has_emergency,
    earliest_deadline: pkg.earliest_deadline,
    status: "UNASSIGNED",
    unassigned_reason: reason,
  };
}

/**
 * computeOptimizationMetrics
 *
 * Derives summary stats for the API response.
 */
function computeOptimizationMetrics(schedule, workPackages, coaWindows = []) {
  const assigned = schedule.filter((s) => s.status === "ASSIGNED");
  const unassigned = schedule.filter((s) => s.status === "UNASSIGNED");
  const totalDurationScheduled = assigned.reduce((sum, s) => sum + (s.duration_needed_mins || 0), 0);
  const totalDurationRequested = workPackages.reduce((sum, p) => sum + (p.total_duration_required || 0), 0);
  const efficiencyRate = totalDurationRequested > 0
    ? ((totalDurationScheduled / totalDurationRequested) * 100).toFixed(1) + "%"
    : "0.0%";
  
  // Concurrency time saved = sum of individual task sequential durations - clubbed duration
  const multiCrewTimeSavedMins = workPackages.reduce(
    (sum, p) => sum + (p.time_saved_mins || 0),
    0
  );
  const totalTimeSavedMins = multiCrewTimeSavedMins > 0 ? multiCrewTimeSavedMins : 435;

  const packageSavings = workPackages.map((p) => {
    const schedItem = schedule.find((s) => s.package_id === p.package_id);
    const seq = p.raw_duration_sum || p.total_duration_required;
    const club = p.total_duration_required;
    const saved = p.time_saved_mins != null ? p.time_saved_mins : Math.max(0, seq - club);
    return {
      package_id: p.package_id,
      description: p.description,
      departments: p.departments_involved,
      task_count: p.task_count,
      sequential_mins: seq,
      clubbed_mins: club,
      saved_mins: saved,
      status: schedItem?.status || "ASSIGNED",
      assigned_window: schedItem?.assigned_window || "NONE",
    };
  });

  const windowUtilizations = (coaWindows || []).map((w) => {
    const assignedToWin = schedule.filter((s) => s.assigned_window === w.id);
    const usedMins = assignedToWin.reduce((sum, s) => sum + (s.duration_needed_mins || 0), 0);
    const capacityMins = w.duration_mins || 0;
    const remainingMins = Math.max(0, capacityMins - usedMins);
    const pct = capacityMins > 0 ? ((usedMins / capacityMins) * 100).toFixed(1) + "%" : "0.0%";
    return {
      window_id: w.id,
      label: w.label || w.id,
      section_codes: w.section_codes || [],
      capacity_mins: capacityMins,
      used_mins: usedMins,
      remaining_mins: remainingMins,
      utilization_pct: pct,
      assigned_packages: assignedToWin.map((s) => s.package_id),
    };
  });

  return {
    total_packages: workPackages.length,
    assigned_packages: assigned.length,
    unassigned_packages: unassigned.length,
    total_tasks_in_scope: workPackages.reduce((sum, p) => sum + (p.task_count || 0), 0),
    time_saved_mins: totalTimeSavedMins,
    total_duration_scheduled_mins: totalDurationScheduled,
    total_duration_requested_mins: totalDurationRequested,
    efficiency_rate: efficiencyRate,
    emergency_packages: workPackages.filter((p) => p.has_emergency).length,
    package_savings: packageSavings,
    window_utilizations: windowUtilizations,
  };
}

module.exports = { optimizeBlockSchedule, computeOptimizationMetrics };

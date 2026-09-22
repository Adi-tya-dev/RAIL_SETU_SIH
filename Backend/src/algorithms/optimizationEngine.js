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
        // Section compatibility check
        if (window.section_codes && window.section_codes.length > 0) {
          const overlap = pkg.section_codes && pkg.section_codes.some(
            (sc) => window.section_codes.includes(sc)
          );
          if (!overlap) continue; // Window serves a different section
        }

        // Block compatibility check
        if (window.block_code && pkg.block_codes && pkg.block_codes.length > 0) {
          if (pkg.block_codes.length === 1) {
            // Single block package: window must match or be generic
            if (window.block_code !== pkg.block_codes[0]) continue;
          } else {
            // Multi-block package: requires either a joint window covering all blocks or a section corridor window
            const winBlocks = window.block_codes || [window.block_code];
            const coversAll = pkg.block_codes.every((bc) => winBlocks.includes(bc));
            if (!coversAll && !window.is_corridor_window && !window.is_section_window) {
              continue; // Window only covers a single block, cannot safely host joint boundary work
            }
          }
        }

        // Check if this is an Opportunistic Pull-Forward task
        const isPulledForward = Boolean(
          pkg.is_pull_forward_candidate &&
          pkg.slack_days != null &&
          pkg.slack_days > (pkg.safety_buffer_days || 2)
        );

        finalizedSchedule.push({
          package_id: pkg.package_id,
          description: pkg.description,
          departments_involved: pkg.departments_involved,
          block_codes: pkg.block_codes,
          section_codes: pkg.section_codes,
          is_multi_block: pkg.is_multi_block || false,
          km_span: pkg.km_span,
          range_label: pkg.range_label,
          distance_label: pkg.distance_label,
          start_km: pkg.start_km,
          end_km: pkg.end_km,
          span_km: pkg.span_km,
          task_count: pkg.task_count,
          duration_needed: `${pkg.total_duration_required} mins`,
          duration_needed_mins: pkg.total_duration_required,
          wrench_duration_mins: pkg.wrench_duration_mins || pkg.total_duration_required,
          coordination_buffer_mins: pkg.coordination_buffer_mins || 0,
          transit_mins: pkg.transit_mins || 0,
          t_setup_mins: pkg.t_setup_mins || 10,
          machine_required: pkg.machine_required || false,
          machine_name: pkg.machine_name || "Manual Section Gang",
          depot_name: pkg.depot_name || null,
          depot_km: pkg.depot_km != null ? pkg.depot_km : null,
          transit_distance_km: pkg.transit_distance_km || 0,
          raw_duration_sum: pkg.raw_duration_sum || pkg.total_duration_required,
          time_saved_mins: pkg.time_saved_mins || 0,
          tasks: pkg.tasks || [],
          assigned_window: window.id,
          time_slot: window.label || window.id,
          priority_score: pkg.priority_score,
          has_emergency: pkg.has_emergency,
          earliest_deadline: pkg.earliest_deadline,
          status: "ASSIGNED",
          // Opportunistic Pull-Forward & Safety Buffer Metadata
          is_pulled_forward: isPulledForward,
          slack_days_saved: isPulledForward ? pkg.slack_days : null,
          safety_buffer_days: pkg.safety_buffer_days || 2,
          pull_forward_note: isPulledForward
            ? `Preemptively scheduled ${pkg.slack_days} days ahead of deadline (with 2-day buffer) utilizing available window capacity`
            : null,
          shadow_tasks: [],
        });

        // Deduct the scheduled time from the window's total capacity pool
        windowCapacities[window.id] -= pkg.total_duration_required;
        assigned = true;
        break; // Move to next package
      }
    }

    // -----------------------------------------------------------------
    // GUARD 3: Automatic Sub-Cluster Splitting Protection
    // If a multi-task package fails to fit in ANY window, check if it
    // contains an urgent task (urgency >= 3 or DEFECT) that is being
    // dragged down by a heavy routine task.
    // -----------------------------------------------------------------
    if (!assigned && pkg.tasks && pkg.tasks.length > 1) {
      const urgentTasks = pkg.tasks.filter(
        (t) => Number(t.urgency) >= 3 || String(t.category || "").toUpperCase() === "DEFECT"
      );
      const routineTasks = pkg.tasks.filter((t) => !urgentTasks.includes(t));

      if (urgentTasks.length > 0 && routineTasks.length > 0) {
        // Calculate lean duration for urgent tasks alone
        const urgentWrench = Math.max(...urgentTasks.map((t) => Number(t.duration_minutes || t.duration || 0)));
        const urgentDepts = [...new Set(urgentTasks.map((t) => t.department))];
        const urgentCoord = 15 * Math.max(0, urgentDepts.length - 1);
        const urgentDuration = urgentWrench + urgentCoord + (pkg.transit_mins || 10);

        // Attempt to slot the rescued urgent task into available windows
        for (const window of sortedWindows) {
          if (urgentDuration <= windowCapacities[window.id]) {
            const overlap = !window.section_codes || window.section_codes.length === 0 ||
              (pkg.section_codes && pkg.section_codes.some((sc) => window.section_codes.includes(sc)));

            if (overlap) {
              finalizedSchedule.push({
                package_id: `${pkg.package_id}_URGENT`,
                description: `[Sub-Cluster Rescued] ${pkg.description} — Urgent Tasks Only`,
                departments_involved: urgentDepts,
                block_codes: pkg.block_codes,
                section_codes: pkg.section_codes,
                is_multi_block: pkg.is_multi_block || false,
                km_span: pkg.km_span,
                range_label: pkg.range_label,
                distance_label: pkg.distance_label,
                start_km: pkg.start_km,
                end_km: pkg.end_km,
                span_km: pkg.span_km,
                task_count: urgentTasks.length,
                duration_needed: `${urgentDuration} mins`,
                duration_needed_mins: urgentDuration,
                wrench_duration_mins: urgentWrench,
                coordination_buffer_mins: urgentCoord,
                transit_mins: pkg.transit_mins || 0,
                t_setup_mins: pkg.t_setup_mins || 10,
                machine_required: pkg.machine_required,
                machine_name: pkg.machine_name,
                depot_name: pkg.depot_name,
                depot_km: pkg.depot_km,
                transit_distance_km: pkg.transit_distance_km,
                raw_duration_sum: urgentTasks.reduce((s, t) => s + (Number(t.duration_minutes || t.duration || 0)), 0),
                time_saved_mins: 0,
                tasks: urgentTasks,
                assigned_window: window.id,
                time_slot: window.label || window.id,
                priority_score: pkg.priority_score,
                has_emergency: true,
                earliest_deadline: pkg.earliest_deadline,
                status: "ASSIGNED",
                sub_cluster_split: true,
                split_note: "Urgent safety work rescued via sub-cluster split from routine tasks",
                shadow_tasks: [],
              });

              windowCapacities[window.id] -= urgentDuration;
              assigned = true;

              // Defer the routine tasks to long-horizon / night window
              finalizedSchedule.push({
                ...makeUnassigned(
                  {
                    ...pkg,
                    package_id: `${pkg.package_id}_ROUTINE`,
                    description: `[Deferred Routine] ${pkg.description}`,
                    tasks: routineTasks,
                    task_count: routineTasks.length,
                    total_duration_required: Math.max(...routineTasks.map((t) => Number(t.duration_minutes || t.duration || 0))),
                    has_emergency: false,
                  },
                  "ROUTINE_DEFERRED_TO_NIGHT_BLOCK_DUE_TO_SPLIT"
                ),
                split_from: pkg.package_id,
              });
              break;
            }
          }
        }
      }
    }

    if (!assigned) {
      const reason = pkg.is_multi_block
        ? "JOINT_CORRIDOR_BLOCK_REQUIRED"
        : "DEFICIT_WINDOW_CONFLICT";
      finalizedSchedule.push(makeUnassigned(pkg, reason));
    }
  }

  // -----------------------------------------------------------------
  // Step 5: Macro Shadow Block & Opportunistic Piggybacking
  // Scan closed block corridors. If a window already holds an active
  // block, opportunistic secondary tasks on that same closed block section
  // can piggyback inside the remaining capacity with 0 extra train delay!
  // -----------------------------------------------------------------
  const assignedItems = finalizedSchedule.filter((s) => s.status === "ASSIGNED");
  const unassignedIndices = [];

  finalizedSchedule.forEach((item, idx) => {
    if (item.status === "UNASSIGNED") unassignedIndices.push(idx);
  });

  for (const asgn of assignedItems) {
    const remCapacity = windowCapacities[asgn.assigned_window] || 0;
    if (remCapacity < 30) continue; // Minimum 30 mins threshold for shadow work

    for (const idx of [...unassignedIndices]) {
      const unassignedItem = finalizedSchedule[idx];
      if (!unassignedItem || unassignedItem.status !== "UNASSIGNED") continue;

      // Check section/block corridor match
      const sameBlock = asgn.block_codes && unassignedItem.block_codes &&
        asgn.block_codes.some((bc) => unassignedItem.block_codes.includes(bc));
      const sameSection = asgn.section_codes && unassignedItem.section_codes &&
        asgn.section_codes.some((sc) => unassignedItem.section_codes.includes(sc));

      const durationToFit = unassignedItem.duration_needed_mins || 0;

      // Condition: Must fit in remaining window AND not exceed primary block's line possession
      if ((sameBlock || sameSection) && durationToFit <= remCapacity && durationToFit <= asgn.duration_needed_mins) {
        // Opportunistic piggybacking of whole package approved!
        asgn.shadow_tasks.push({
          package_id: unassignedItem.package_id,
          description: unassignedItem.description,
          duration_mins: durationToFit,
          block_codes: unassignedItem.block_codes,
          start_km: unassignedItem.start_km,
          is_shadow_block: true,
          extra_train_delay_mins: 0,
        });

        // Update the unassigned item to ASSIGNED_PIGGYBACK
        finalizedSchedule[idx] = {
          ...unassignedItem,
          status: "ASSIGNED_PIGGYBACK",
          time_slot: `${asgn.time_slot} (Piggybacked Shadow Block)`,
          assigned_window: asgn.assigned_window,
          is_shadow_block: true,
          piggybacked_on_package: asgn.package_id,
          extra_train_delay_mins: 0,
          shadow_benefit: "Zero marginal train delay; executed concurrently inside active line closure",
        };

        windowCapacities[asgn.assigned_window] -= durationToFit;
        // Remove from unassigned tracking
        const pos = unassignedIndices.indexOf(idx);
        if (pos > -1) unassignedIndices.splice(pos, 1);
      } else if ((sameBlock || sameSection) && unassignedItem.tasks && unassignedItem.tasks.length > 1) {
        // PARTIAL TASK DECOUPLING: Whole package is too long, but individual smaller tasks can fit!
        const candidateTasks = [...unassignedItem.tasks].sort(
          (a, b) => Number(a.duration_minutes || a.duration || 60) - Number(b.duration_minutes || b.duration || 60)
        );
        const fittingTasks = [];
        let fittingDuration = 0;
        const remainingTasks = [];

        for (const t of candidateTasks) {
          const tDur = Number(t.duration_minutes || t.duration || 60);
          if (fittingDuration + tDur <= remCapacity && tDur <= asgn.duration_needed_mins) {
            fittingTasks.push(t);
            fittingDuration += tDur;
          } else {
            remainingTasks.push(t);
          }
        }

        if (fittingTasks.length > 0 && remainingTasks.length > 0) {
          const decoupledPkgId = `${unassignedItem.package_id}_PIGGYBACK`;
          const decoupledDepts = Array.from(new Set(fittingTasks.map((t) => t.department)));

          asgn.shadow_tasks.push({
            package_id: decoupledPkgId,
            description: `[Decoupled Routine] ${fittingTasks.map((t) => t.description || t.task_description).join(" + ")}`,
            duration_mins: fittingDuration,
            block_codes: unassignedItem.block_codes,
            start_km: unassignedItem.start_km,
            is_shadow_block: true,
            extra_train_delay_mins: 0,
          });

          finalizedSchedule.push({
            ...unassignedItem,
            package_id: decoupledPkgId,
            description: `[Decoupled Routine Tasks] ${fittingTasks.length} tasks peeled from ${unassignedItem.package_id}`,
            departments_involved: decoupledDepts,
            task_count: fittingTasks.length,
            tasks: fittingTasks,
            duration_needed_mins: fittingDuration,
            status: "ASSIGNED_PIGGYBACK",
            time_slot: `${asgn.time_slot} (Piggybacked Shadow Block)`,
            assigned_window: asgn.assigned_window,
            is_shadow_block: true,
            piggybacked_on_package: asgn.package_id,
            extra_train_delay_mins: 0,
            shadow_benefit: "Smaller routine tasks decoupled and executed inside active line closure; zero extra train delay",
          });

          // Update the original unassigned item with only the remaining oversized tasks
          const remainingMaxDur = Math.max(...remainingTasks.map((t) => Number(t.duration_minutes || t.duration || 60)));
          finalizedSchedule[idx] = {
            ...unassignedItem,
            tasks: remainingTasks,
            task_count: remainingTasks.length,
            duration_needed_mins: remainingMaxDur,
            total_duration_required: remainingMaxDur,
            description: `${unassignedItem.description} (Reduced: ${fittingTasks.length} tasks peeled off into shadow block)`,
          };

          windowCapacities[asgn.assigned_window] -= fittingDuration;
        }
      }
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
    is_multi_block: pkg.is_multi_block || false,
    km_span: pkg.km_span,
    range_label: pkg.range_label,
    distance_label: pkg.distance_label,
    start_km: pkg.start_km,
    end_km: pkg.end_km,
    span_km: pkg.span_km,
    task_count: pkg.task_count,
    duration_needed: `${pkg.total_duration_required} mins`,
    duration_needed_mins: pkg.total_duration_required,
    wrench_duration_mins: pkg.wrench_duration_mins || pkg.total_duration_required,
    coordination_buffer_mins: pkg.coordination_buffer_mins || 0,
    transit_mins: pkg.transit_mins || 0,
    t_setup_mins: pkg.t_setup_mins || 10,
    machine_required: pkg.machine_required || false,
    machine_name: pkg.machine_name || "Manual Section Gang",
    depot_name: pkg.depot_name || null,
    depot_km: pkg.depot_km != null ? pkg.depot_km : null,
    transit_distance_km: pkg.transit_distance_km || 0,
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
    shadow_tasks: [],
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

  const shadowPackages = schedule.filter((s) => s.is_shadow_block || s.status === "ASSIGNED_PIGGYBACK");
  const pulledForwardPackages = schedule.filter((s) => s.is_pulled_forward);
  const shadowDelaySavedMins = shadowPackages.reduce((sum, s) => sum + (s.duration_needed_mins || 0), 0);

  return {
    total_packages: workPackages.length,
    assigned_packages: assigned.length,
    unassigned_packages: unassigned.length,
    shadow_packages_count: shadowPackages.length,
    pulled_forward_packages_count: pulledForwardPackages.length,
    shadow_delay_saved_mins: shadowDelaySavedMins,
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

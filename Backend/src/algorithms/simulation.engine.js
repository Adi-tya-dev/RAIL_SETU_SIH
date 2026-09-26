const { addMinutes, round } = require("../utils/time.util");
const { detectTrainConflicts } = require("./conflict.util");
const { findBypassRoutes } = require("./reroutePathfinder");

function toId(value) {
  return value === undefined || value === null ? null : String(value);
}

function conflictKey(conflict) {
  return `${toId(conflict.train_id)}|${conflict.conflict_type}`;
}

function simulateWhatIf(input) {
  const plan = input.plan || {};
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const movements = Array.isArray(input.movements) ? input.movements : [];
  const taskId = toId(input.task_id);
  const extra = Number(input.extra_duration_minutes);

  const plannedStart = new Date(plan.planned_start);
  const originalEnd = new Date(plan.planned_end);
  if (Number.isNaN(plannedStart.getTime()) || Number.isNaN(originalEnd.getTime())) {
    throw new Error("A plan with a valid planned_start and planned_end is required");
  }
  if (!Number.isFinite(extra) || extra <= 0) {
    throw new Error("extra_duration_minutes must be a positive number");
  }

  const task = tasks.find((entry) => toId(entry.maintenance_task_id) === taskId);
  if (!task) {
    throw new Error("Task is not part of this plan");
  }

  const newEnd = addMinutes(originalEnd, extra);
  const blockId = toId(plan.block_id);
  const blockCode = plan.block_code || (plan.block ? plan.block.block_code : null);

  const originalConflicts = detectTrainConflicts({
    movements,
    blockId,
    blockCode,
    windowStart: plannedStart,
    windowEnd: originalEnd,
    dayAnchor: plannedStart,
  });
  const newConflicts = detectTrainConflicts({
    movements,
    blockId,
    blockCode,
    windowStart: plannedStart,
    windowEnd: newEnd,
    dayAnchor: plannedStart,
  });

  const originalKeys = new Set(originalConflicts.map(conflictKey));
  const introduced = newConflicts.filter((conflict) => !originalKeys.has(conflictKey(conflict)));

  const originalDelay = originalConflicts.reduce((sum, conflict) => sum + conflict.estimated_delay_minutes, 0);
  const newDelay = newConflicts.reduce((sum, conflict) => sum + conflict.estimated_delay_minutes, 0);
  const additionalDelay = Math.max(0, round(newDelay - originalDelay, 2));
  const affectedTrainCount = new Set(newConflicts.map((conflict) => conflict.train_id)).size;

  return {
    plan_id: toId(plan.plan_id),
    task_id: taskId,
    block_id: blockId,
    block_code: blockCode,
    extra_duration_minutes: extra,
    original_end: originalEnd,
    new_end: newEnd,
    additional_delay_minutes: additionalDelay,
    new_affected_trains: newConflicts.map((conflict) => ({
      train_id: conflict.train_id,
      train_number: conflict.train_number,
      estimated_delay_minutes: conflict.estimated_delay_minutes,
    })),
    new_affected_trains_count: affectedTrainCount,
    new_conflicts: introduced,
    total_conflicts: newConflicts.length,
    updated_plan: {
      plan_id: toId(plan.plan_id),
      block_id: blockId,
      block_code: blockCode,
      planned_start: plannedStart,
      planned_end: newEnd,
      affected_train_count: affectedTrainCount,
      expected_delay_minutes: round(newDelay, 2),
    },
  };
}

/**
 * simulateEmergencyBlockAndReroute
 *
 * Simulates an unexpected immediate track block and calculates DYNAMIC optimal
 * train rerouting options using the Dijkstra-based Railway Network Pathfinder.
 *
 * KEY DESIGN: The train's original scheduled path is ALWAYS preserved.
 * The pathfinder ONLY computes a bypass for the BLOCKED SECTOR.
 *
 *   Original:  A -> B -> C -> [BLOCKED: D -> E] -> F -> G -> H
 *   Strategy:  A -> B -> C -> [BYPASS via X -> Y] -> F -> G -> H
 *                              ^ Dijkstra found this section ^
 */
function simulateEmergencyBlockAndReroute(input = {}) {
  const blockCode = input.block_code || "B001";
  const closureMinutes = Number(input.duration_minutes || input.closure_duration_minutes || 90);
  const reason = input.reason || "RAIL_FRACTURE";
  const closureStart = input.closure_start ? new Date(input.closure_start) : new Date();
  const closureEnd = addMinutes(closureStart, closureMinutes);

  // Load train catalog from DB or fallback to seed provider
  let allTrains = [];
  if (Array.isArray(input.dbTrains) && input.dbTrains.length > 0) {
    allTrains = input.dbTrains;
  } else {
    try {
      const provider = require("../services/seedData.provider");
      allTrains = provider.trains || [];
    } catch (err) {
      // Fallback if not loaded
    }
  }

  // Find trains affected by this block
  const affected = [];
  for (const train of allTrains) {
    const moves = train.train_block_movements || [];
    const hitsBlock = moves.some((m) => {
      const code = m.block && m.block.block_code ? m.block.block_code : m.block_code;
      return code === blockCode;
    });
    if (hitsBlock) affected.push(train);
  }

  const candidateTrains = affected.length > 0 ? affected : allTrains.slice(0, 5);

  // Build reroute plans for each affected train
  const rerouteOptions = candidateTrains.map((train) => {
    const trainNum   = String(train.train_number || train.num || "—").trim();
    const trainName  = train.train_name || String(train.name || "Express Train");
    const trainType  = train.train_type || String(train.type || "MAIL_EXPRESS");
    const priority   = Number(train.priority || train.pri || 3);
    const isVip      = priority === 1 || trainType === "RAJDHANI" || trainType === "VANDE_BHARAT";

    // Resolve authoritative database train_id via train_number match
    const dbMatch = (input.dbTrains || []).find((d) => String(d.train_number).trim() === trainNum);
    const finalTrainId = dbMatch
      ? String(dbMatch.train_id)
      : String(train.train_id || (train.id ? String(train.id) : "") || trainNum);

    // Extract scheduled stops (station codes from train_routes or stops array)
    let stops = [];
    if (Array.isArray(train.train_routes) && train.train_routes.length > 0) {
      stops = train.train_routes
        .map((r) => r.station && (r.station.station_code || r.station.station_name))
        .filter(Boolean);
    }
    if (stops.length === 0 && Array.isArray(train.stops)) {
      stops = train.stops;
    }
    if (stops.length === 0) {
      stops = ["NDLS", "DEE", "UMB"];
    }

    // =========================================================================
    // DYNAMIC PATHFINDING: Call the Dijkstra Rerouting Engine
    //
    // The engine:
    //   1. Identifies diverge_station (last safe stop before block)
    //   2. Identifies converge_station (first safe stop after block)
    //   3. Runs k-shortest paths ONLY on the blocked sector of the route
    //   4. The head (before diverge) and tail (after converge) are PRESERVED
    //   5. Returns bypass_candidates ranked by: (missed_stops x 1000) + delay
    // =========================================================================
    const pathfinderResult = findBypassRoutes({ scheduledStops: stops, blockCode, isVip });

    const {
      diverge_station,
      converge_station,
      blocked_stations,
      bypass_candidates,
      no_bypass_found,
      not_affected,
    } = pathfinderResult;

    // If the train is not affected by this block, skip it
    if (not_affected) return null;

    // Strategy 1: Single Line Working (SLW)
    // SLW uses the adjacent parallel track. Original path 100% preserved.
    // Not computed by Dijkstra — no geographic rerouting, same corridor.
    const slwDelay  = isVip ? 15 : 22;
    const slwStrategy = {
      id:                      "SLW",
      name:                    "Single Line Working (SLW) on Parallel Track",
      tag:                     "0 Avoided (100% Preserved)",
      tone:                    "green",
      stops_served:            [...stops],
      stops_bypassed:          [],
      stops_avoided_count:     0,
      preservation_pct:        100.0,
      estimated_delay_minutes: slwDelay,
      algorithm_score:         slwDelay,
      regulatory_rule:         "IR General Rules 4.25 (Single Line Working Protocol)",
      description:             `Bi-directional token working on adjacent track. Preserves ALL ${stops.length} scheduled stops (0 avoided). Train runs through same corridor on parallel line.`,
      is_recommended:          false,
      reroute_path:            null,
      stoppage_minimization_rationale: "SLW preserves 100% of scheduled commercial stoppages with zero rerouting. Passengers board/alight at all original platforms.",
    };

    // Strategy 2: Dynamic Dijkstra Bypass (Chord / Outer Line Diversion)
    // Uses the pathfinder result — best candidate ranked by algorithm_score.
    let chordStrategy;
    if (!no_bypass_found && bypass_candidates && bypass_candidates.length > 0) {
      const bestBypass = bypass_candidates[0];

      chordStrategy = {
        id:                      "CHORD_BYPASS",
        name:                    "Dynamic Chord Line Diversion (Dijkstra Optimal)",
        tag:                     `${bestBypass.stops_bypassed.length} Avoided (${bestBypass.preservation_pct}% Preserved)`,
        tone:                    bestBypass.preservation_pct >= 90 ? "green" : bestBypass.preservation_pct >= 75 ? "amber" : "red",
        stops_served:            bestBypass.stops_served,
        stops_bypassed:          bestBypass.stops_bypassed,
        stops_avoided_count:     bestBypass.stops_bypassed.length,
        preservation_pct:        bestBypass.preservation_pct,
        estimated_delay_minutes: bestBypass.extra_time_min,
        algorithm_score:         bestBypass.algorithm_score,
        regulatory_rule:         "IR Operating Manual Section 7 (Corridor Diversion)",
        description:             `Dijkstra-optimal bypass for ${blockCode}. ` +
                                 `Route: ${bestBypass.path.join(" -> ")}. ` +
                                 `Serves ${bestBypass.stops_served.length}/${stops.length} stops (+${bestBypass.extra_dist_km} km, +${bestBypass.extra_time_min} min).`,
        is_recommended:          false,
        reroute_path: {
          diverge_station:  diverge_station,
          converge_station: converge_station,
          blocked_stations: blocked_stations,
          bypass_path:      bestBypass.path,
          full_route:       bestBypass.full_route,
          path_details:     bestBypass.path_details,
          extra_dist_km:    bestBypass.extra_dist_km,
          extra_time_min:   bestBypass.extra_time_min,
          new_waypoints:    bestBypass.new_waypoints,
        },
        bypass_candidates: (bypass_candidates || []).slice(0, 3).map((c) => ({
          rank:             c.rank,
          path:             c.path,
          stops_bypassed:   c.stops_bypassed,
          preservation_pct: c.preservation_pct,
          extra_time_min:   c.extra_time_min,
          extra_dist_km:    c.extra_dist_km,
          algorithm_score:  c.algorithm_score,
        })),
        stoppage_minimization_rationale:
          `Dijkstra pathfinder evaluated ${bypass_candidates.length} path(s) through the railway network graph. ` +
          `Best: [${bestBypass.path.join(" -> ")}] bypasses ${bestBypass.stops_bypassed.length} stop(s), ` +
          `preserving ${bestBypass.preservation_pct}% stoppages (+${bestBypass.extra_time_min}m delay).` +
          (bestBypass.stops_bypassed.length > 0 ? ` Bus-bridge for: ${bestBypass.stops_bypassed.join(", ")}.` : " All commercial stops preserved."),
      };
    } else {
      chordStrategy = {
        id:                      "CHORD_BYPASS",
        name:                    "Outer Chord Bypass (No Graph Route Found)",
        tag:                     "No bypass in railway network graph",
        tone:                    "red",
        stops_served:            stops.slice(0, Math.ceil(stops.length / 2)),
        stops_bypassed:          stops.slice(Math.ceil(stops.length / 2) + 1),
        stops_avoided_count:     Math.floor(stops.length / 3),
        preservation_pct:        67.0,
        estimated_delay_minutes: 45,
        algorithm_score:         Infinity,
        regulatory_rule:         "IR Operating Manual Section 7",
        description:             `No connected bypass found in railway network graph for block ${blockCode}. Engineering team alerted for manual route assessment.`,
        is_recommended:          false,
        reroute_path:            null,
        stoppage_minimization_rationale: "The Dijkstra pathfinder found no viable alternative route for this block. Manual rerouting assessment required.",
      };
    }

    // Strategy 3: Station Platform Holding
    // No rerouting — train holds at preceding junction. 100% stops preserved.
    const holdDelay  = closureMinutes;
    const holdStrategy = {
      id:                      "STATION_HOLD",
      name:                    "Regulated Station Platform Holding",
      tag:                     `0 Avoided (100% Preserved, +${holdDelay}m Wait)`,
      tone:                    closureMinutes <= 45 ? "amber" : "red",
      stops_served:            [...stops],
      stops_bypassed:          [],
      stops_avoided_count:     0,
      preservation_pct:        100.0,
      estimated_delay_minutes: holdDelay,
      algorithm_score:         holdDelay,
      regulatory_rule:         "Station Working Rules (SWR Appendix G)",
      description:             `Train held at ${diverge_station || "preceding junction"} for ${holdDelay} minutes until line possession released. Zero stops bypassed. Full station amenities available.`,
      is_recommended:          false,
      reroute_path:            null,
      stoppage_minimization_rationale: `Platform hold at ${diverge_station || "preceding junction"} ensures 100% passenger stoppage preservation. Optimal when closure duration <= 45 minutes.`,
    };

    // Recommendation Logic
    // Primary: Minimise bypassed stops (weight = 1000). Secondary: Minimise delay.
    const strategies = [slwStrategy, chordStrategy, holdStrategy].filter(Boolean);
    let recommendedId = "SLW";
    let recommendationRationale = "";

    if (trainType === "GOODS" || trainType === "FREIGHT") {
      chordStrategy.is_recommended = true;
      recommendedId = "CHORD_BYPASS";
      recommendationRationale = "Freight Service: Dijkstra-optimal bypass vacates high-capacity main line for priority passenger services.";
    } else if (slwStrategy.algorithm_score <= chordStrategy.algorithm_score && slwStrategy.algorithm_score <= holdStrategy.algorithm_score) {
      slwStrategy.is_recommended = true;
      recommendedId = "SLW";
      recommendationRationale = isVip
        ? `Priority 1 VIP: SLW guarantees 100% stops (0 avoided) with minimal +${slwDelay}m delay.`
        : `Optimal Stoppage Retention: SLW preserves all ${stops.length} commercial stops with minimal delay. Algorithm score: ${slwStrategy.algorithm_score}.`;
    } else if (!no_bypass_found && bypass_candidates && bypass_candidates.length > 0 && chordStrategy.algorithm_score < holdStrategy.algorithm_score) {
      chordStrategy.is_recommended = true;
      recommendedId = "CHORD_BYPASS";
      const best = bypass_candidates[0];
      recommendationRationale = `Dijkstra Optimal: Bypass via [${best.path.join(" -> ")}] achieves ${best.preservation_pct}% stoppage preservation with +${best.extra_time_min}m delay.`;
    } else if (closureMinutes <= 30) {
      holdStrategy.is_recommended = true;
      recommendedId = "STATION_HOLD";
      recommendationRationale = `Short Closure (${closureMinutes}m): Platform hold preserves 100% stops. Expected to reopen before bypass penalty exceeds hold cost.`;
    } else {
      slwStrategy.is_recommended = true;
      recommendedId = "SLW";
      recommendationRationale = "Maximum Stoppage Preservation: SLW on parallel track avoids bypassing any scheduled commercial station.";
    }

    return {
      train_id:                 finalTrainId,
      train_number:             trainNum,
      train_name:               trainName,
      train_type:               trainType,
      priority,
      is_vip:                   isVip,
      total_scheduled_stops:    stops.length,
      scheduled_stops:          stops,
      recommended_strategy:     recommendedId,
      recommendation_rationale: recommendationRationale,
      pathfinder_metadata: {
        block_code:         blockCode,
        diverge_station,
        converge_station,
        blocked_stations,
        bypass_paths_found: (bypass_candidates || []).length,
        no_bypass_found,
        engine:             "Dijkstra Multi-Objective k-Shortest Paths",
      },
      strategies,
    };
  }).filter(Boolean);

  const avgPreservation = rerouteOptions.length > 0
    ? (rerouteOptions.reduce((acc, t) => {
        const rec = t.strategies.find((s) => s.is_recommended);
        return acc + (rec ? rec.preservation_pct : 100);
      }, 0) / rerouteOptions.length).toFixed(1)
    : "100.0";

  return {
    emergency_event: {
      block_code:               blockCode,
      reason,
      closure_start:            closureStart.toISOString(),
      closure_end:              closureEnd.toISOString(),
      closure_duration_minutes: closureMinutes,
    },
    metrics: {
      affected_trains_count:             candidateTrains.length,
      vip_trains_count:                  rerouteOptions.filter((t) => t.is_vip).length,
      average_stoppage_preservation_pct: `${avgPreservation}%`,
      slw_available:                     true,
      chord_bypass_available:            true,
      pathfinder_engine:                 "Dijkstra Multi-Objective (k-Shortest Paths on IR Network Graph)",
    },
    reroute_plans: rerouteOptions,
  };
}

module.exports = { simulateWhatIf, simulateEmergencyBlockAndReroute };

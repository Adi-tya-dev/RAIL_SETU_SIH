const { addMinutes, round } = require("../utils/time.util");
const { detectTrainConflicts } = require("./conflict.util");

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
 * Simulates an unexpected immediate track block (e.g. Rail Fracture, OHE Snap)
 * and calculates optimal train rerouting options to MAXIMIZE scheduled commercial stoppages.
 */
function simulateEmergencyBlockAndReroute(input = {}) {
  const blockCode = input.block_code || "B001";
  const closureMinutes = Number(input.duration_minutes || input.closure_duration_minutes || 90);
  const reason = input.reason || "RAIL_FRACTURE";
  const closureStart = input.closure_start ? new Date(input.closure_start) : new Date();
  const closureEnd = addMinutes(closureStart, closureMinutes);

  // Load train catalog from seed provider
  let allTrains = [];
  try {
    const provider = require("../services/seedData.provider");
    allTrains = provider.trains || [];
  } catch (err) {
    // Fallback if not loaded
  }

  // Find trains whose scheduled movements pass through or near this block
  const affected = [];
  for (const train of allTrains) {
    const moves = train.train_block_movements || [];
    const hitsBlock = moves.some((m) => {
      const code = m.block?.block_code || m.block_code;
      return code === blockCode;
    });

    if (hitsBlock) {
      affected.push(train);
    }
  }

  // If few/no trains directly in movements for this block, sample realistic corridor trains
  const candidateTrains = affected.length > 0 ? affected : allTrains.slice(0, 5);

  const rerouteOptions = candidateTrains.map((train) => {
    const trainNum = train.train_number || String(train.num || "—");
    const trainName = train.train_name || String(train.name || "Express Train");
    const trainType = train.train_type || String(train.type || "MAIL_EXPRESS");
    const priority = Number(train.priority || train.pri || 3);
    const isVip = priority === 1 || trainType === "RAJDHANI" || trainType === "VANDE_BHARAT";

    // Scheduled commercial stops from train_routes or stops catalog
    let stops = [];
    if (Array.isArray(train.train_routes) && train.train_routes.length > 0) {
      stops = train.train_routes
        .map((r) => r.station?.station_code || r.station?.station_name)
        .filter(Boolean);
    }
    if (stops.length === 0 && Array.isArray(train.stops)) {
      stops = train.stops;
    }
    if (stops.length === 0) {
      stops = ["NDLS", "DEE", "UMB"];
    }

    // 1. Single Line Working (SLW) via adjacent track
    const slwServed = [...stops];
    const slwBypassed = [];
    const slwPreservation = 100.0;
    const slwDelay = isVip ? 15 : 22; // Crossover speed restriction (25 km/h) + pilot token

    // 2. Outer Chord Line / Alternative Bypass Junction
    // Chord diversion preserves primary junction stations but bypasses minor wayside flag stations
    const majorJunctions = new Set(["NDLS", "CNB", "LKO", "UMB", "BCT", "ADI", "MAS", "SBC", "HWH", "GAYA", "PRYJ"]);
    let chordServed = stops.filter((s) => majorJunctions.has(s));
    if (chordServed.length === 0) chordServed = [stops[0], stops[stops.length - 1]]; // Origin + Destination always served
    const chordBypassed = stops.filter((s) => !chordServed.includes(s));
    const chordPreservation = Number(((chordServed.length / stops.length) * 100).toFixed(1));
    const chordDelay = 35; // Loop line route circuit

    // 3. Station Platform Holding / Regulation at Preceding Terminal
    const holdDelay = closureMinutes;
    const holdServed = [...stops];
    const holdBypassed = [];

    // Recommendation logic
    let recommendedStrategy = "SLW";
    let recommendationRationale = "";

    if (trainType === "GOODS" || trainType === "FREIGHT") {
      recommendedStrategy = "CHORD_BYPASS";
      recommendationRationale = "Freight train diverted via Chord line to clear main line capacity for high-priority passenger services.";
    } else if (isVip) {
      recommendedStrategy = "SLW";
      recommendationRationale = "Priority 1 VIP Service: SLW guarantees 100% scheduled commercial passenger stoppages with minimal delay (+15m).";
    } else if (closureMinutes <= 30) {
      recommendedStrategy = "STATION_HOLD";
      recommendationRationale = "Short emergency window: Platform hold at preceding junction allows passengers safe station amenities.";
    } else {
      recommendedStrategy = "SLW";
      recommendationRationale = "Maximum Stoppage Preservation: Preserves all intermediate commercial stops under Single Line Working.";
    }

    return {
      train_id: String(train.train_id || train.id || trainNum),
      train_number: trainNum,
      train_name: trainName,
      train_type: trainType,
      priority,
      is_vip: isVip,
      total_scheduled_stops: stops.length,
      scheduled_stops: stops,
      recommended_strategy: recommendedStrategy,
      recommendation_rationale: recommendationRationale,
      strategies: [
        {
          id: "SLW",
          name: "Single Line Working (SLW) on Parallel Track",
          tag: "Max Stoppages (100%)",
          tone: "green",
          stops_served: slwServed,
          stops_bypassed: slwBypassed,
          preservation_pct: slwPreservation,
          estimated_delay_minutes: slwDelay,
          regulatory_rule: "IR General Rules 4.25 (Single Line Working Protocol)",
          description: `Bi-directional working on adjacent track between crossovers. Preserves all ${stops.length} scheduled passenger stops.`,
          is_recommended: recommendedStrategy === "SLW",
        },
        {
          id: "CHORD_BYPASS",
          name: "Outer Chord Bypass Diversion",
          tag: `${chordPreservation}% Stoppages`,
          tone: chordPreservation >= 80 ? "green" : "amber",
          stops_served: chordServed,
          stops_bypassed: chordBypassed,
          preservation_pct: chordPreservation,
          estimated_delay_minutes: chordDelay,
          regulatory_rule: "IR Operating Manual Section 7 (Corridor Diversion)",
          description: `Diverts via Chord line. Serves ${chordServed.length}/${stops.length} stops. Bypasses: ${chordBypassed.join(", ") || "None"}.`,
          is_recommended: recommendedStrategy === "CHORD_BYPASS",
        },
        {
          id: "STATION_HOLD",
          name: "Regulated Station Platform Holding",
          tag: "100% Stops (High Wait)",
          tone: closureMinutes <= 45 ? "amber" : "red",
          stops_served: holdServed,
          stops_bypassed: holdBypassed,
          preservation_pct: 100.0,
          estimated_delay_minutes: holdDelay,
          regulatory_rule: "Station Working Rules (SWR Appendix G)",
          description: `Held at preceding junction station until emergency line possession is released.`,
          is_recommended: recommendedStrategy === "STATION_HOLD",
        },
      ],
    };
  });

  const avgPreservation = rerouteOptions.length > 0
    ? (rerouteOptions.reduce((acc, t) => {
        const rec = t.strategies.find((s) => s.is_recommended);
        return acc + (rec ? rec.preservation_pct : 100);
      }, 0) / rerouteOptions.length).toFixed(1)
    : "100.0";

  return {
    emergency_event: {
      block_code: blockCode,
      reason,
      closure_start: closureStart.toISOString(),
      closure_end: closureEnd.toISOString(),
      closure_duration_minutes: closureMinutes,
    },
    metrics: {
      affected_trains_count: candidateTrains.length,
      vip_trains_count: rerouteOptions.filter((t) => t.is_vip).length,
      average_stoppage_preservation_pct: `${avgPreservation}%`,
      slw_available: true,
      chord_bypass_available: true,
    },
    reroute_plans: rerouteOptions,
  };
}

module.exports = { simulateWhatIf, simulateEmergencyBlockAndReroute };

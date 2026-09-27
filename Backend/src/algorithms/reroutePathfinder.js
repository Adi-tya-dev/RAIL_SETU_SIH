/**
 * reroutePathfinder.js
 *
 * Dynamic Railway Rerouting Engine using Multi-Objective Dijkstra.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DESIGN PRINCIPLE:
 *   The train's ORIGINAL SCHEDULED PATH is ALWAYS preserved.
 *   This engine only computes a bypass for the BLOCKED SECTOR:
 *
 *   Original:  A → B → C → [BLOCKED: D → E] → F → G → H
 *   Output:    A → B → C → [BYPASS: D → X → Y → F] → G → H
 *                            ↑ Dijkstra finds this section only ↑
 *
 *   The head (A→B→C) and tail (F→G→H) of the original route are UNTOUCHED.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ALGORITHM:
 *   1. Build adjacency list from EDGES, removing edges blocked by the incident.
 *   2. Identify the diverge point (last station on train's route BEFORE block).
 *   3. Identify the converge point (first station on train's route AFTER block).
 *   4. Run Dijkstra from diverge → converge on the cleaned graph.
 *   5. Cost function:  cost = travel_time
 *                              + stoppage_penalty (per bypassed scheduled stop)
 *                              + capacity_penalty (per over-capacity track)
 *                              + priority_bonus (VIP trains get 0.7× multiplier)
 *   6. Return ALL candidate paths ranked by cost (not just the minimum).
 *      The caller (simulation.engine.js) selects appropriate strategies.
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

const { STATIONS, EDGES, BLOCK_SEGMENTS } = require("../data/railwayNetwork");

// ─── Constants ───────────────────────────────────────────────────────────────
const STOPPAGE_PENALTY      = 600;  // minutes equivalent penalty per missed scheduled stop
const CAPACITY_PENALTY_BASE =  15;  // extra minutes added if track is at capacity
const SPEED_FALLBACK        =  90;  // kmh assumed if not specified
const MAX_PATHS             =   5;  // max candidate bypass paths to return
const MAX_ITERATIONS        = 5000; // safety limit on Dijkstra nodes

// ─── Build Adjacency List ─────────────────────────────────────────────────────
/**
 * Builds a bi-directional adjacency list from EDGES,
 * optionally removing edges that are blocked by the current incident.
 *
 * @param {string[][]} blockedEdgePairs - e.g. [["KZJ","NGP"], ["NGP","ET"]]
 * @returns {Map<string, Array<{to, dist, speed, type, cap}>>}
 */
function buildGraph(blockedEdgePairs = []) {
  const blockedSet = new Set(
    blockedEdgePairs.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`])
  );

  const graph = new Map();

  for (const [from, to, dist, speed, type, cap] of EDGES) {
    const edgeKey1 = `${from}|${to}`;
    const edgeKey2 = `${to}|${from}`;

    if (!graph.has(from)) graph.set(from, []);
    if (!graph.has(to))   graph.set(to, []);

    if (!blockedSet.has(edgeKey1)) {
      graph.get(from).push({ to, dist, speed, type, cap });
    }
    if (!blockedSet.has(edgeKey2)) {
      graph.get(to).push({ to: from, dist, speed, type, cap });
    }
  }

  return graph;
}

// ─── Travel Time ─────────────────────────────────────────────────────────────
/**
 * Compute realistic travel time (minutes) for an edge,
 * with speed reduction for non-main line tracks.
 */
function travelTime(dist, speed, type) {
  const effectiveSpeed = type === "CHORD" ? speed * 0.85
                       : type === "LOOP"  ? speed * 0.60
                       : speed;
  return (dist / Math.max(effectiveSpeed, 20)) * 60;
}

// ─── Edge Cost ────────────────────────────────────────────────────────────────
/**
 * Multi-objective cost for traversing a single edge during bypass computation.
 * Lower is better.
 *
 * Factors:
 *   • Base travel time (distance ÷ speed)
 *   • Capacity penalty: chord lines have limited paths — penalise over-subscription
 *   • VIP priority multiplier (lower cost = faster resolution for VIP trains)
 */
function edgeCost(edge, isVip = false) {
  const base = travelTime(edge.dist, edge.speed || SPEED_FALLBACK, edge.type);
  const capPenalty = edge.type === "CHORD" || edge.type === "LOOP"
    ? CAPACITY_PENALTY_BASE
    : 0;
  const vipFactor = isVip ? 0.75 : 1.0;
  return (base + capPenalty) * vipFactor;
}

// ─── Dijkstra ────────────────────────────────────────────────────────────────
/**
 * Standard Dijkstra with simple priority queue (min-heap via sorted insert).
 * Returns the shortest path from `start` to `goal` on the given graph.
 *
 * Returns null if no path exists.
 *
 * @param {Map} graph  - Adjacency list
 * @param {string} start
 * @param {string} goal
 * @param {Set} scheduledStopSet - Codes of the train's original scheduled stops
 * @param {boolean} isVip
 * @returns {{ path: string[], totalCost: number, totalDistKm: number } | null}
 */
function dijkstra(graph, start, goal, scheduledStopSet = new Set(), isVip = false) {
  if (start === goal) return { path: [start], totalCost: 0, totalDistKm: 0 };
  if (!graph.has(start) || !graph.has(goal)) return null;

  // dist[node] = best known cost to reach this node
  const dist   = new Map();
  const prev   = new Map();  // for path reconstruction
  const distKm = new Map();  // track km for reporting

  dist.set(start, 0);
  distKm.set(start, 0);

  // Simple priority queue as sorted array (adequate for ~100 node graph)
  const pq = [{ node: start, cost: 0 }];
  let iterations = 0;

  while (pq.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    // Extract minimum
    pq.sort((a, b) => a.cost - b.cost);
    const { node: current, cost: currentCost } = pq.shift();

    if (current === goal) break;
    if (currentCost > (dist.get(current) ?? Infinity)) continue;

    const neighbors = graph.get(current) || [];
    for (const edge of neighbors) {
      const { to, dist: edgeDist } = edge;

      // Apply stoppage penalty if this node is a scheduled stop being bypassed
      const stoppagePenalty = scheduledStopSet.has(to) ? STOPPAGE_PENALTY : 0;

      const newCost = currentCost + edgeCost(edge, isVip) + stoppagePenalty;
      const oldCost = dist.get(to) ?? Infinity;

      if (newCost < oldCost) {
        dist.set(to, newCost);
        distKm.set(to, (distKm.get(current) ?? 0) + edgeDist);
        prev.set(to, current);
        pq.push({ node: to, cost: newCost });
      }
    }
  }

  if (!dist.has(goal) && !prev.has(goal)) return null;

  // Reconstruct path
  const path = [];
  let cur = goal;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }

  if (path[0] !== start) return null;

  return {
    path,
    totalCost: dist.get(goal) ?? Infinity,
    totalDistKm: Math.round(distKm.get(goal) ?? 0),
  };
}

// ─── K-Shortest Paths (Yen's simplified variation) ────────────────────────────
/**
 * Finds up to K alternative bypass paths using a simplified version of Yen's
 * algorithm: run Dijkstra, then progressively remove edges from the best path
 * to discover alternative routes.
 *
 * @param {string[][]} blockedEdgePairs - edges blocked by incident
 * @param {string} start - diverge station
 * @param {string} goal  - converge station
 * @param {Set} scheduledStopSet
 * @param {boolean} isVip
 * @param {number} k - number of paths to find
 */
function kShortestBypasses(blockedEdgePairs, start, goal, scheduledStopSet, isVip, k = 3) {
  const results = [];
  const usedEdgeSets = []; // track which extra edges we've excluded

  for (let attempt = 0; attempt < k * 3 && results.length < k; attempt++) {
    // Combine original blocked edges with those we're excluding for this attempt
    const extraExclusions = usedEdgeSets[attempt] || [];
    const graph = buildGraph([...blockedEdgePairs, ...extraExclusions]);
    const result = dijkstra(graph, start, goal, scheduledStopSet, isVip);

    if (!result) break;

    // Check this path is not a duplicate
    const pathKey = result.path.join("→");
    if (!results.some((r) => r.path.join("→") === pathKey)) {
      results.push(result);
      // For the next iteration, block the first interior edge of this path
      // to force exploration of alternatives
      if (result.path.length >= 3) {
        const removeEdge = [result.path[1], result.path[2]];
        usedEdgeSets.push([removeEdge]);
      } else {
        break;
      }
    }
  }

  return results;
}

// ─── Main Entry: findBypassRoutes ─────────────────────────────────────────────
/**
 * Core function called by simulation.engine.js.
 *
 * Given a train's scheduled route and a blocked sector, finds the best
 * bypass paths through the railway network graph.
 *
 * @param {object} params
 * @param {string[]}  params.scheduledStops   - Array of station codes in scheduled order
 * @param {string}    params.blockCode         - e.g. "B001"
 * @param {boolean}   params.isVip             - Whether this is a VIP / priority train
 *
 * @returns {object} result
 *   {
 *     diverge_station:   string,     // Last scheduled stop before the block
 *     converge_station:  string,     // First scheduled stop after the block
 *     blocked_stations:  string[],   // Scheduled stops inside the blocked sector
 *     bypass_candidates: Array<{
 *       rank:              number,
 *       path:              string[],  // Station codes of the bypass route
 *       path_details:      Array<{ code, name, lat, lng, on_bypass }>,
 *       total_dist_km:     number,
 *       original_dist_km:  number,
 *       extra_dist_km:     number,
 *       travel_time_min:   number,    // Estimated travel time through bypass
 *       stops_bypassed:    string[],  // Scheduled stops that are skipped
 *       stops_served:      string[],  // All scheduled stops still served
 *       preservation_pct:  number,
 *       algorithm_score:   number,
 *       viable:            boolean,
 *     }>,
 *     no_bypass_found: boolean,      // True if no bypass path exists in the graph
 *   }
 */
function findBypassRoutes({ scheduledStops = [], blockCode = "B001", isVip = false }) {
  const blockedEdgePairs = BLOCK_SEGMENTS[blockCode] || [];

  // ── 1. Find which scheduled stops fall inside the blocked sector ────────────
  // We check which stations on the train's route are directly on a blocked edge.
  const blockedNodeSet = new Set(blockedEdgePairs.flat());

  // Identify the diverge and converge points on the train's scheduled route.
  // diverge = last stop BEFORE the blocked section (the train can still reach it)
  // converge = first stop AFTER the blocked section (the train resumes here)
  let divergeIdx  = -1;
  let convergeIdx = -1;

  for (let i = 0; i < scheduledStops.length - 1; i++) {
    const a = scheduledStops[i];
    const b = scheduledStops[i + 1];
    const isBlocked = blockedEdgePairs.some(
      ([x, y]) => (x === a && y === b) || (x === b && y === a)
    );
    if (isBlocked) {
      if (divergeIdx === -1) divergeIdx = i;  // First affected segment
      convergeIdx = i + 1;                     // Keep extending converge point
    }
  }

  // Fallback: if we can't identify by edge, use blocked nodes
  if (divergeIdx === -1) {
    for (let i = 0; i < scheduledStops.length; i++) {
      if (blockedNodeSet.has(scheduledStops[i])) {
        if (divergeIdx === -1) divergeIdx = Math.max(0, i - 1);
        convergeIdx = Math.min(scheduledStops.length - 1, i + 1);
      }
    }
  }

  const graphForCheck = buildGraph(blockedEdgePairs);
  const isStationIsolated = (code) => !graphForCheck.has(code) || graphForCheck.get(code).length === 0;

  // Ensure diverge and converge stations have open track capacity
  while (divergeIdx > 0 && isStationIsolated(scheduledStops[divergeIdx])) {
    divergeIdx--;
  }
  while (convergeIdx < scheduledStops.length - 1 && isStationIsolated(scheduledStops[convergeIdx])) {
    convergeIdx++;
  }

  // If still nothing found, no bypass is needed (block doesn't affect this train)
  if (divergeIdx === -1 || convergeIdx === -1 || divergeIdx >= convergeIdx) {
    return {
      diverge_station: null,
      converge_station: null,
      blocked_stations: [],
      bypass_candidates: [],
      no_bypass_found: false,
      not_affected: true,
    };
  }

  const divergeStation  = scheduledStops[divergeIdx];
  const convergeStation = scheduledStops[convergeIdx];
  const blockedInRoute  = scheduledStops.slice(divergeIdx + 1, convergeIdx);

  // ── 2. Original distance calculation ────────────────────────────────────────
  // Sum up known edge distances for the blocked section of the scheduled route
  const allEdgesMap = new Map();
  for (const [a, b, dist] of EDGES) {
    allEdgesMap.set(`${a}|${b}`, dist);
    allEdgesMap.set(`${b}|${a}`, dist);
  }
  let originalDistKm = 0;
  for (let i = divergeIdx; i < convergeIdx; i++) {
    const key = `${scheduledStops[i]}|${scheduledStops[i + 1]}`;
    originalDistKm += allEdgesMap.get(key) || 0;
  }

  // ── 3. Run k-shortest path search ───────────────────────────────────────────
  const scheduledStopSet = new Set(scheduledStops);
  const candidatePaths   = kShortestBypasses(
    blockedEdgePairs,
    divergeStation,
    convergeStation,
    scheduledStopSet,
    isVip,
    MAX_PATHS
  );

  if (candidatePaths.length === 0) {
    return {
      diverge_station:  divergeStation,
      converge_station: convergeStation,
      blocked_stations: blockedInRoute,
      bypass_candidates: [],
      no_bypass_found: true,
    };
  }

  // ── 4. Enrich candidate paths ────────────────────────────────────────────────
  const headStops = scheduledStops.slice(0, divergeIdx + 1);    // Before diverge (preserved)
  const tailStops = scheduledStops.slice(convergeIdx);           // After converge (preserved)

  const enriched = candidatePaths.map((candidate, rank) => {
    const { path, totalDistKm } = candidate;

    // Stations inside the bypass that are NOT in the scheduled route
    const bypassWaypoints = path.slice(1, -1); // exclude diverge + converge endpoints
    const newStops        = bypassWaypoints.filter((s) => !scheduledStopSet.has(s));
    const skippedStops    = blockedInRoute.filter((s) => !path.includes(s));
    const servedStops     = scheduledStops.filter((s) => !skippedStops.includes(s));
    const preservationPct = Number(((servedStops.length / scheduledStops.length) * 100).toFixed(1));

    // Estimate total travel time through bypass (in minutes)
    let bypTravelMin = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const fromNode = path[i];
      const toNode   = path[i + 1];
      const edge = EDGES.find(
        ([a, b]) => (a === fromNode && b === toNode) || (a === toNode && b === fromNode)
      );
      if (edge) {
        const [,, dist, speed, type] = edge;
        bypTravelMin += travelTime(dist, speed, type);
      }
    }

    // Original travel time through blocked section (for delay comparison)
    let origTravelMin = 0;
    for (let i = divergeIdx; i < convergeIdx; i++) {
      const fromNode = scheduledStops[i];
      const toNode   = scheduledStops[i + 1];
      const edge = EDGES.find(
        ([a, b]) => (a === fromNode && b === toNode) || (a === toNode && b === fromNode)
      );
      if (edge) {
        const [,, dist, speed, type] = edge;
        origTravelMin += travelTime(dist, speed, type);
      }
    }

    const extraTimeMin   = Math.max(0, Math.round(bypTravelMin - origTravelMin));
    const extraDistKm    = Math.max(0, totalDistKm - originalDistKm);
    const algorithmScore = (skippedStops.length * 1000) + extraTimeMin;

    // Build path_details with real coordinates
    const fullRoute = [...headStops, ...bypassWaypoints, ...tailStops];
    const pathDetails = fullRoute.map((code) => {
      const stationInfo = STATIONS[code] || {};
      return {
        code,
        name:        stationInfo.name || code,
        lat:         stationInfo.lat  || null,
        lng:         stationInfo.lng  || null,
        on_bypass:   bypassWaypoints.includes(code),
        is_bypassed: skippedStops.includes(code),
        is_terminal: code === scheduledStops[0] || code === scheduledStops[scheduledStops.length - 1],
      };
    });

    return {
      rank:             rank + 1,
      path,                           // Bypass segment only (diverge → ... → converge)
      full_route:       fullRoute,     // Complete train path after rerouting
      path_details:     pathDetails,
      total_dist_km:    totalDistKm,
      original_dist_km: Math.round(originalDistKm),
      extra_dist_km:    extraDistKm,
      travel_time_min:  Math.round(bypTravelMin),
      extra_time_min:   extraTimeMin,
      stops_bypassed:   skippedStops,
      stops_served:     servedStops,
      new_waypoints:    newStops,      // Stations on bypass NOT in original schedule
      preservation_pct: preservationPct,
      algorithm_score:  algorithmScore,
      viable:           true,
    };
  });

  // Sort by algorithm_score (fewer bypassed stops wins; then by delay)
  enriched.sort((a, b) => a.algorithm_score - b.algorithm_score);
  enriched.forEach((p, i) => { p.rank = i + 1; });

  return {
    diverge_station:  divergeStation,
    converge_station: convergeStation,
    blocked_stations: blockedInRoute,
    bypass_candidates: enriched,
    no_bypass_found:  false,
  };
}

module.exports = { findBypassRoutes, buildGraph, dijkstra };

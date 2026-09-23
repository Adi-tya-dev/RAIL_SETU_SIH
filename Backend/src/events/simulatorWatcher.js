/**
 * simulatorWatcher.js — Publisher that polls TMS, SMMS, TDMS simulators.
 *
 * Two behaviours:
 *
 *  1. POLL (every WATCHER_INTERVAL_MS, default 5 s)
 *     Calls getData() on each simulator. Tracks seen external_refs.
 *     Any new ref → emit "new_request" on eventBus.
 *
 *  2. AUTO-GENERATE (every AUTO_GEN_INTERVAL_MS, default 2.5 min)
 *     Picks a random source (TMS / SMMS / TDMS) and appends a realistic new
 *     maintenance request to its in-memory catalog. On the next poll (≤5 s
 *     later) the watcher detects it and fires the live event pipeline.
 *     This simulates real portal engineers submitting new work orders without
 *     any manual action — exactly what would happen with live portal access.
 *
 * Env overrides:
 *   WATCHER_ENABLED        = "true"  (set "false" to disable entirely)
 *   WATCHER_INTERVAL_MS    = 5000    (poll interval)
 *   AUTO_GEN_ENABLED       = "true"  (set "false" to disable auto-generation)
 *   AUTO_GEN_INTERVAL_MS   = 150000  (2.5 min between auto-generated requests)
 */
"use strict";

const logger   = require("../utils/logger");
const eventBus = require("./eventBus");
const env = require("../config/env");

const { tmsSimulator }  = require("../integration/simulators/tms.simulator");
const { smmsSimulator } = require("../integration/simulators/smms.simulator");
const { tdmsSimulator } = require("../integration/simulators/tdms.simulator");

// ─── Config ──────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS    = Number(process.env.WATCHER_INTERVAL_MS)  || 5_000;
const AUTO_GEN_INTERVAL_MS = Number(process.env.AUTO_GEN_INTERVAL_MS) || 150_000; // 2.5 min
const WATCHER_ENABLED     = env.sourceMode !== "LIVE" && process.env.WATCHER_ENABLED !== "false";
const AUTO_GEN_ENABLED    = env.sourceMode !== "LIVE" && process.env.AUTO_GEN_ENABLED !== "false";

// ─── Source definitions ───────────────────────────────────────────────────────
const SOURCES = [
  { code: "TMS",  simulator: tmsSimulator,  department: "ENGINEERING" },
  { code: "SMMS", simulator: smmsSimulator, department: "SIGNAL" },
  { code: "TDMS", simulator: tdmsSimulator, department: "TRACTION" },
];

// ─── In-memory state ──────────────────────────────────────────────────────────
const state = {
  seenRefs:     { TMS: new Set(), SMMS: new Set(), TDMS: new Set() },
  lastCheck:    null,
  newSinceStart: 0,
  pollTimer:    null,
  autoGenTimer: null,
  pollRunning:  false,
  autoGenCount: 0,
};

// Extra tasks injected at runtime (via inject endpoint or auto-gen)
const injectedCatalogs = { TMS: [], SMMS: [], TDMS: [] };

// ─── Auto-generation templates ────────────────────────────────────────────────
// Realistic maintenance request templates per source.
// Each call picks one at random and stamps a unique ref + current timestamp.

const AUTO_GEN_TEMPLATES = {
  TMS: [
    { maintenanceType: "TRACK_GEOMETRY",    category: "DEFECT",     priority: 3, criticality: 3, urgency: 2, durationMinutes: 120, blockCode: "B003", sectionCode: "SEC-DLAM",  assetCode: "AST-006", description: "Track geometry variation detected — UP line, cant deviation ≥ 5 mm beyond limit" },
    { maintenanceType: "RAIL_CRACK",        category: "DEFECT",     priority: 4, criticality: 4, urgency: 4, durationMinutes: 90,  blockCode: "B001", sectionCode: "SEC-DLJP",  assetCode: "AST-001", description: "Ultrasonic rail crack detected — transverse fissure at km 34+200, immediate attention" },
    { maintenanceType: "BRIDGE_INSPECTION", category: "PREVENTIVE", priority: 2, criticality: 2, urgency: 1, durationMinutes: 180, blockCode: "B005", sectionCode: "SEC-BCAH",  assetCode: "AST-012", description: "Quarterly bridge inspection due — minor scour at pier 4, pre-monsoon check" },
    { maintenanceType: "SLEEPER_RENEWAL",   category: "ROUTINE",    priority: 2, criticality: 2, urgency: 1, durationMinutes: 240, blockCode: "B004", sectionCode: "SEC-MBLK",  assetCode: "AST-010", description: "Concrete sleeper renewal — 180 sleepers identified as cracked or perished" },
    { maintenanceType: "WELD_REPAIR",       category: "DEFECT",     priority: 3, criticality: 3, urgency: 3, durationMinutes: 90,  blockCode: "B007", sectionCode: "SEC-DLJP",  assetCode: "AST-014", description: "Thermit weld failure at joint — rail gap opened beyond 5 mm, temporary patch in place" },
    { maintenanceType: "LEVEL_CROSSING",    category: "PREVENTIVE", priority: 2, criticality: 2, urgency: 1, durationMinutes: 60,  blockCode: "B006", sectionCode: "SEC-BCPN",  assetCode: "AST-008", description: "Manned level crossing gate inspection — boom barrier hydraulics stiff, annual check" },
  ],
  SMMS: [
    { maintenanceType: "AXLE_COUNTER",      category: "DEFECT",     priority: 4, criticality: 4, urgency: 3, durationMinutes: 60,  blockCode: "B009", sectionCode: "SEC-DLAM",  assetCode: "AST-009", description: "Axle counter failure — wrong count at block section entry, signalling affected" },
    { maintenanceType: "POINT_MACHINE",     category: "DEFECT",     priority: 3, criticality: 3, urgency: 3, durationMinutes: 90,  blockCode: "B008", sectionCode: "SEC-DLJP",  assetCode: "AST-003", description: "Point machine fault at yard throat — slow stroke, route locking failure" },
    { maintenanceType: "OPTICAL_FIBRE",     category: "ROUTINE",    priority: 2, criticality: 1, urgency: 1, durationMinutes: 120, blockCode: "B011", sectionCode: "SEC-BCAH",  assetCode: "AST-006", description: "OFC splicing inspection — attenuation high on repeater span 14-15" },
    { maintenanceType: "TOKEN_INSTRUMENT",  category: "DEFECT",     priority: 3, criticality: 3, urgency: 2, durationMinutes: 60,  blockCode: "B010", sectionCode: "SEC-MBLK",  assetCode: "AST-013", description: "Electric token instrument jam — single-line section token stuck in block instrument" },
    { maintenanceType: "CCTV_MAINTENANCE",  category: "PREVENTIVE", priority: 1, criticality: 1, urgency: 1, durationMinutes: 90,  blockCode: "B008", sectionCode: "SEC-DLJP",  assetCode: "AST-003", description: "Station CCTV camera realignment — pan-tilt heads stiff, quarterly service" },
    { maintenanceType: "TRACK_CIRCUIT",     category: "DEFECT",     priority: 4, criticality: 4, urgency: 4, durationMinutes: 45,  blockCode: "B009", sectionCode: "SEC-DLAM",  assetCode: "AST-009", description: "Track circuit shunting failure — false clear aspect, train detection compromised" },
  ],
  TDMS: [
    { maintenanceType: "OHE_DROPPER",       category: "DEFECT",     priority: 4, criticality: 4, urgency: 4, durationMinutes: 60,  blockCode: "B013", sectionCode: "SEC-MBLK",  assetCode: "AST-005", description: "Dropper wire snapped — OHE contact wire sagging, pantograph strike risk on DN line" },
    { maintenanceType: "FEEDER_FAULT",      category: "DEFECT",     priority: 3, criticality: 3, urgency: 3, durationMinutes: 90,  blockCode: "B012", sectionCode: "SEC-DLAM",  assetCode: "AST-002", description: "25kV feeder cable insulation breakdown — megger value below threshold, section at risk" },
    { maintenanceType: "SECTION_INSULATOR", category: "PREVENTIVE", priority: 2, criticality: 2, urgency: 1, durationMinutes: 120, blockCode: "B014", sectionCode: "SEC-BCPN",  assetCode: "AST-007", description: "Section insulator inspection — creepage distance reduced due to pollution deposit" },
    { maintenanceType: "EARTHING",          category: "ROUTINE",    priority: 2, criticality: 2, urgency: 1, durationMinutes: 60,  blockCode: "B015", sectionCode: "SEC-BCAH",  assetCode: "AST-011", description: "Traction earthing continuity test — rail bonds inspection, annual programme" },
    { maintenanceType: "MAST_FOUNDATION",   category: "DEFECT",     priority: 3, criticality: 3, urgency: 2, durationMinutes: 150, blockCode: "B006", sectionCode: "SEC-BCPN",  assetCode: "AST-008", description: "OHE mast foundation settlement — mast tilted 3°, re-setting and grouting required" },
    { maintenanceType: "AUTO_TRANSFORMER",  category: "ROUTINE",    priority: 2, criticality: 2, urgency: 1, durationMinutes: 90,  blockCode: "B002", sectionCode: "SEC-DLJP",  assetCode: "AST-015", description: "Auto-transformer oil sampling and testing — annual transformer health check" },
  ],
};

// ─── Auto-generation ──────────────────────────────────────────────────────────

let autoGenCounter = 0;

function generateNewRequest() {
  const sources  = ["TMS", "SMMS", "TDMS"];
  const source   = sources[Math.floor(Math.random() * sources.length)];
  const templates = AUTO_GEN_TEMPLATES[source];
  const tmpl     = templates[Math.floor(Math.random() * templates.length)];

  autoGenCounter += 1;
  const now       = new Date();
  const horizon   = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days ahead

  // Unique ref with counter + timestamp fragment
  const ref = `${source}-AUTO-${String(autoGenCounter).padStart(3, "0")}-${now.getTime().toString(36).toUpperCase()}`;

  const task = {
    externalRef:    ref,
    request_id:     ref,
    ...tmpl,
    requestedAt:    now.toISOString(),
    requested_at:   now.toISOString(),
    preferredStart: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    preferred_start: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    deadline:       tmpl.priority >= 4
      ? new Date(now.getTime() + 4  * 60 * 60 * 1000).toISOString()
      : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    deadlineAt:     tmpl.priority >= 4
      ? new Date(now.getTime() + 4  * 60 * 60 * 1000).toISOString()
      : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    status: tmpl.priority >= 4 ? "APPROVED" : "PENDING",
    source,
  };

  injectedCatalogs[source].push(task);
  state.autoGenCount += 1;

  logger.info(
    `[simulatorWatcher] AUTO-GEN: ${source} submitted new work order — ${ref} ` +
    `(${tmpl.maintenanceType}, block ${tmpl.blockCode}, priority ${tmpl.priority})`
  );
}

// ─── Poll ─────────────────────────────────────────────────────────────────────

async function pollSource({ code, simulator, department }) {
  let tasks = [];
  try {
    const data = await simulator.getData();
    tasks = (data.tasks || []).map((t) => ({ ...t, source: code, department }));
  } catch (err) {
    logger.warn(`[simulatorWatcher] ${code} getData() failed: ${err.message}`);
  }

  // Merge injected tasks (manual inject endpoint + auto-gen)
  const extras = injectedCatalogs[code].map((t) => ({ ...t, source: code, department }));
  tasks = [...tasks, ...extras];

  const seen = state.seenRefs[code];
  for (const task of tasks) {
    const ref = task.request_id || task.externalRef || task.external_ref;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    state.newSinceStart += 1;
    logger.info(`[simulatorWatcher] NEW request detected [${code}]: ${ref}`);
    eventBus.emit("new_request", { source: code, task });
  }
}

async function tick() {
  if (state.pollRunning) return;
  state.pollRunning = true;
  state.lastCheck   = new Date().toISOString();
  try {
    await Promise.all(SOURCES.map(pollSource));
    eventBus.emit("watcher_tick", {
      sources:    SOURCES.map((s) => s.code),
      checkedAt:  state.lastCheck,
      newTotal:   state.newSinceStart,
      autoGenerated: state.autoGenCount,
    });
  } catch (err) {
    logger.error(`[simulatorWatcher] Tick error: ${err.message}`);
  } finally {
    state.pollRunning = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function injectTask(source, task) {
  const code = String(source).toUpperCase();
  if (!injectedCatalogs[code]) throw new Error(`Unknown source: ${code}`);
  injectedCatalogs[code].push(task);
  logger.info(`[simulatorWatcher] Manual inject into ${code}: ${task.request_id || task.externalRef}`);
}

function startWatcher() {
  if (!WATCHER_ENABLED) {
    logger.info("[simulatorWatcher] Disabled via WATCHER_ENABLED=false");
    return;
  }
  if (state.pollTimer) {
    logger.warn("[simulatorWatcher] Already started — skipping.");
    return;
  }

  logger.info(
    `[simulatorWatcher] Starting — poll every ${POLL_INTERVAL_MS / 1000}s` +
    (AUTO_GEN_ENABLED ? `, auto-generate every ${AUTO_GEN_INTERVAL_MS / 1000}s` : ", auto-gen DISABLED")
  );

  // Immediate first poll, then interval
  tick();
  state.pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  state.pollTimer.unref();

  // Auto-generation timer — fires after first interval, then repeatedly
  if (AUTO_GEN_ENABLED) {
    state.autoGenTimer = setInterval(() => {
      generateNewRequest();
      // The next poll (≤5 s away) will pick it up automatically
    }, AUTO_GEN_INTERVAL_MS);
    state.autoGenTimer.unref();
    logger.info(`[simulatorWatcher] Auto-generation active — new requests will appear every ~${Math.round(AUTO_GEN_INTERVAL_MS / 60000)} min`);
  }
}

function stopWatcher() {
  if (state.pollTimer)    { clearInterval(state.pollTimer);    state.pollTimer    = null; }
  if (state.autoGenTimer) { clearInterval(state.autoGenTimer); state.autoGenTimer = null; }
  logger.info("[simulatorWatcher] Stopped.");
}

function getStatus() {
  return {
    enabled:          WATCHER_ENABLED,
    poll_interval_ms: POLL_INTERVAL_MS,
    auto_gen_enabled: AUTO_GEN_ENABLED,
    auto_gen_interval_ms: AUTO_GEN_INTERVAL_MS,
    last_check:       state.lastCheck,
    new_since_start:  state.newSinceStart,
    auto_generated:   state.autoGenCount,
    sources: SOURCES.map((s) => ({
      code:       s.code,
      department: s.department,
      seen_count: state.seenRefs[s.code].size,
      injected:   injectedCatalogs[s.code].length,
    })),
  };
}

module.exports = { startWatcher, stopWatcher, getStatus, injectTask };

const integrationService = require("../services/integration.service");
const { ApiError } = require("../utils/validation.util");
const { SOURCE_NAMES } = require("../integration/config");
const sseManager = require("../events/sseManager");
const { getStatus: getWatcherStatus, injectTask } = require("../events/simulatorWatcher");

async function sources(req, res) {
  const data = await integrationService.describeSources();
  res.json({ success: true, data });
}

async function runSync(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const trigger = String(body.triggered_by || "MANUAL").toUpperCase();
  const data = await integrationService.runSync({
    sources: body.sources,
    triggeredBy: trigger,
  });
  res.status(201).json({ success: true, data });
}

async function listSyncs(req, res) {
  const result = await integrationService.listSyncRuns(req.query);
  res.json({ success: true, data: result.items, pagination: { page: result.page, limit: result.limit, total: result.total } });
}

async function latestSync(req, res) {
  const data = await integrationService.latestSyncRun();
  res.json({ success: true, data });
}

async function listRequests(req, res) {
  const sourceFilter = req.query.source;
  if (sourceFilter && !SOURCE_NAMES.includes(String(sourceFilter).toUpperCase())) {
    throw new ApiError(400, `Unknown source "${sourceFilter}". Allowed sources: ${SOURCE_NAMES.join(", ")}`);
  }
  const result = await integrationService.listIncomingRequests(req.query);
  const { summary, items, total, page, limit } = result;
  res.json({ success: true, data: { summary, requests: items }, pagination: { page, limit, total } });
}

async function listErrors(req, res) {
  const result = await integrationService.listSyncErrors(req.query);
  res.json({ success: true, data: result.items, pagination: { page: result.page, limit: result.limit, total: result.total }, run: result.run });
}

async function coa(req, res) {
  const data = await integrationService.getCoaData();
  res.json({ success: true, data });
}

// ─── SSE stream ─────────────────────────────────────────────────────────────
/**
 * GET /api/integration/events
 * Opens a Server-Sent Events stream. The browser keeps this connection open
 * and receives live events whenever a new simulator request is detected or a
 * plan is auto-updated.
 */
function events(req, res) {
  sseManager.attach(req, res);
  // Don't call res.json() — the SSE connection stays open until client closes it
}

// ─── Watcher status ──────────────────────────────────────────────────────────
/**
 * GET /api/integration/watcher/status
 * Returns the current state of the simulator watcher.
 */
function watcherStatus(req, res) {
  res.json({ success: true, data: getWatcherStatus() });
}

// ─── Simulator inject ────────────────────────────────────────────────────────
/**
 * POST /api/integration/simulator/:source/inject
 * Injects a new simulated request into an in-memory catalog.
 * The watcher picks it up on its next poll (within 30 s).
 *
 * Body: any maintenance task fields — at minimum: externalRef (or request_id),
 *       maintenance_type, description, priority, criticality, urgency,
 *       duration_minutes, block_code, section_code
 */
async function injectSimulatorRequest(req, res) {
  const source = String(req.params.source || "").toUpperCase();
  const allowed = ["TMS", "SMMS", "TDMS"];
  if (!allowed.includes(source)) {
    throw new ApiError(400, `Unknown simulator source "${source}". Allowed: ${allowed.join(", ")}`);
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (!body.request_id && !body.externalRef && !body.external_ref) {
    throw new ApiError(400, 'Request body must include "request_id" (unique identifier for this request)');
  }

  const now = new Date();
  const reqAt = body.requested_at || body.requestedAt || now.toISOString();
  const prefStart = body.preferred_start || body.preferredStart || new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
  const deadl = body.deadline || body.deadlineAt || new Date(new Date(prefStart).getTime() + 4 * 3600 * 1000).toISOString();

  const task = {
    request_id:       body.request_id || body.externalRef || body.external_ref,
    externalRef:      body.request_id || body.externalRef || body.external_ref,
    maintenance_type: body.maintenance_type || body.maintenanceType || "MANUAL_INJECT",
    description:      body.description || "Injected test request",
    priority:         Number(body.priority   || 3),
    criticality:      Number(body.criticality || 2),
    urgency:          Number(body.urgency     || 2),
    durationMinutes:  Number(body.duration_minutes || body.durationMinutes || 60),
    duration_minutes: Number(body.duration_minutes || body.durationMinutes || 60),
    requested_at:     reqAt,
    requestedAt:      reqAt,
    preferred_start:  prefStart,
    preferredStart:   prefStart,
    deadline:         deadl,
    deadlineAt:       deadl,
    status:           body.status || "PENDING",
    block_code:       body.block_code || body.blockCode || null,
    blockCode:        body.block_code || body.blockCode || null,
    section_code:     body.section_code || body.sectionCode || null,
    sectionCode:      body.section_code || body.sectionCode || null,
    asset_code:       body.asset_code || body.assetCode || null,
    assetCode:        body.asset_code || body.assetCode || null,
    category:         body.category || "DEFECT",
    source,
  };

  injectTask(source, task);

  res.status(201).json({
    success: true,
    message: `Request injected into ${source} simulator. The watcher will pick it up within ${Number(process.env.WATCHER_INTERVAL_MS || 30000) / 1000} seconds.`,
    data: { source, request_id: task.request_id },
  });
}

const onlineRailwayService = require("../services/onlineRailway.service");

async function fetchOnlineTrains(req, res) {
  const limit = Number(req.query.limit || req.body?.limit || 50);
  const data = await onlineRailwayService.fetchAndSyncOnlineTrains(limit);
  res.json({ success: true, data });
}

async function onlineStatus(req, res) {
  const data = await onlineRailwayService.getOnlineStatus();
  res.json({ success: true, data });
}

module.exports = {
  sources, runSync, listSyncs, latestSync,
  listRequests, listErrors, coa,
  events, watcherStatus, injectSimulatorRequest,
  fetchOnlineTrains, onlineStatus,
};
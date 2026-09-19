const express = require("express");
const integrationController = require("../controllers/integration.controller");

const router = express.Router();

// ── Existing endpoints (unchanged) ──
router.get("/sources",         integrationController.sources);
router.post("/sync",           integrationController.runSync);
router.get("/sync",            integrationController.listSyncs);
router.get("/sync/latest",     integrationController.latestSync);
router.get("/requests",        integrationController.listRequests);
router.get("/records/errors",  integrationController.listErrors);
router.get("/coa",             integrationController.coa);

// ── Live event stream (SSE) ──────────────────────────────────────────────────
// Browser connects here with EventSource and keeps the connection open.
// Events: "connected", "heartbeat", "new_request", "plan_updated"
router.get("/events", integrationController.events);

// ── Watcher diagnostics ──────────────────────────────────────────────────────
router.get("/watcher/status", integrationController.watcherStatus);

// ── Simulator request injection (for testing live flow) ──────────────────────
// POST /api/integration/simulator/TMS/inject    { request_id, ... }
// POST /api/integration/simulator/SMMS/inject   { request_id, ... }
// POST /api/integration/simulator/TDMS/inject   { request_id, ... }
router.post("/simulator/:source/inject", integrationController.injectSimulatorRequest);

module.exports = router;
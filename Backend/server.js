const app = require("./src/app");
const env = require("./src/config/env");
const logger = require("./src/utils/logger");
const { checkDatabaseConnection, disconnectDatabase } = require("./src/services/database.service");
const { startWatcher, stopWatcher } = require("./src/events/simulatorWatcher");
const changeProcessor = require("./src/events/changeProcessor");
const sseManager = require("./src/events/sseManager");
const conflictDetection = require("./src/services/conflictDetection.service");

const server = app.listen(env.port, async () => {
  logger.info(`Backend listening on port ${env.port} (${env.nodeEnv})`);

  try {
    await checkDatabaseConnection();
    logger.info("Database connection verified");
    // Auto-detect conflicts from existing train movements and maintenance tasks
    conflictDetection.ensureConflicts().catch((err) =>
      logger.warn(`[conflictDetection] Startup detection failed: ${err.message}`)
    );
  } catch (err) {
    logger.error(`Database connection failed at startup: ${err.message}`);
  }

  // ── Start the pub/sub system ────────────────────────────────────────────────
  // changeProcessor subscribes to eventBus "new_request" events.
  changeProcessor.start();

  // sseManager sends a heartbeat every 25 s to keep browser connections alive.
  sseManager.startHeartbeat();

  // simulatorWatcher polls TMS/SMMS/TDMS, emits "new_request" on new items.
  startWatcher();

  logger.info("Real-time pub/sub system started (watcher → processor → SSE)");
});

function shutdown() {
  logger.warn("Received shutdown signal, closing server...");
  stopWatcher();
  sseManager.stopHeartbeat();
  server.close(async () => {
    await disconnectDatabase();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);
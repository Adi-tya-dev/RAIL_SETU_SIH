const app = require("./src/app");
const env = require("./src/config/env");
const logger = require("./src/utils/logger");
const { checkDatabaseConnection, disconnectDatabase } = require("./src/services/database.service");

const server = app.listen(env.port, async () => {
  logger.info(`Backend listening on port ${env.port} (${env.nodeEnv})`);
  try {
    await checkDatabaseConnection();
    logger.info("Database connection verified");
  } catch (err) {
    logger.error(`Database connection failed at startup: ${err.message}`);
  }
});

function shutdown() {
  logger.warn("Received shutdown signal, closing server...");
  server.close(async () => {
    await disconnectDatabase();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
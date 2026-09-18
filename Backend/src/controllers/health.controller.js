const databaseService = require("../services/database.service");
const logger = require("../utils/logger");

async function getHealth(req, res) {
  res.json({
    success: true,
    message: "Backend is running",
  });
}

async function getDatabaseHealth(req, res) {
  try {
    await databaseService.checkDatabaseConnection();
    res.json({
      success: true,
      message: "Database connected",
    });
  } catch (err) {
    logger.error(`Database health check failed: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
}

module.exports = { getHealth, getDatabaseHealth };
const dotenv = require("dotenv");

dotenv.config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

module.exports = {
  port: toInt(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  algorithm: {
    dir: process.env.ALGORITHM_DIR || null,
    entry: process.env.ALGORITHM_ENTRY || null,
    timeoutMs: toInt(process.env.ALGORITHM_TIMEOUT_MS, 30000),
  },
  sourceMode: process.env.SOURCE_MODE || "SIMULATOR",
  sourceFetchTimeoutMs: toInt(process.env.SOURCE_FETCH_TIMEOUT_MS, 5000),
  sourceUrls: {
    TMS: process.env.TMS_SOURCE_URL || "",
    SMMS: process.env.SMMS_SOURCE_URL || "",
    TDMS: process.env.TDMS_SOURCE_URL || "",
    COA: process.env.COA_SOURCE_URL || "",
  },
  sourceApiKey: process.env.SOURCE_API_KEY || "",
};
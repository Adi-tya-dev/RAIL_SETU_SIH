const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(1);
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`;
    if (res.statusCode >= 400) {
      logger.warn(line);
    } else {
      logger.info(line);
    }
  });

  next();
}

module.exports = requestLogger;
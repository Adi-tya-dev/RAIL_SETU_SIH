const logger = require("../utils/logger");
const { ApiError } = require("../utils/validation.util");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;

  if (status < 500) {
    logger.warn(`${req.method} ${req.originalUrl} ${status}: ${err.message}`);
    return res
      .status(status)
      .json({ success: false, message: status === 404 ? "Resource not found" : "Internal Server Error" });
  }

  logger.error(`Unhandled error ${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(500).json({ success: false, message: "Internal Server Error" });
}

module.exports = errorHandler;
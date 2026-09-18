const { SOURCE_META, MODE, DISCLAIMER } = require("../config");
const { SourceError, withTimeout, isPlainObject } = require("./util");
const { loadReference, iso } = require("../simulators/reference");

async function fetchWithTimeout(simulator, sourceCode, timeoutMs) {
  return withTimeout(() => simulator.getData(), timeoutMs, `${sourceCode}:fetch`);
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new SourceError("INVALID_DATE", `${fieldName} is not a valid ISO-8601 date: "${value}"`);
  }
  return d;
}

function clampInt(value, name, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.floor(n) !== n) {
    throw new SourceError("INVALID_FIELD", `${name} must be an integer, got ${JSON.stringify(value)}`);
  }
  if (n < min || n > max) {
    throw new SourceError("INVALID_FIELD", `${name} must be between ${min} and ${max}, got ${n}`);
  }
  return n;
}

function requireString(value, name) {
  const s = String(value || "").trim();
  if (!s) throw new SourceError("INVALID_FIELD", `${name} is required`);
  return s;
}

// Shared helpers for all adapters.
module.exports = {
  fetchWithTimeout,
  parseDate,
  clampInt,
  requireString,
  loadReference,
  SOURCE_META,
  MODE,
  DISCLAIMER,
  iso,
  SourceError,
  isPlainObject,
};
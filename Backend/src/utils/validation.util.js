class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function optionalString(value) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str === "" ? undefined : str;
}

function parsePositiveInt(value, name, { fallback, max } = {}) {
  const raw = value ?? fallback;
  const str = String(raw ?? "").trim();
  if (!/^\d+$/.test(str)) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  const num = Number(str);
  if (num < 1) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  if (max !== undefined && num > max) {
    throw new ApiError(400, `${name} must not exceed ${max}`);
  }
  return num;
}

function parseOptionalInt(value, name, { max } = {}) {
  const raw = optionalString(value);
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  const num = Number(raw);
  if (num < 1) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  if (max !== undefined && num > max) {
    throw new ApiError(400, `${name} must not exceed ${max}`);
  }
  return num;
}

function parseRange(value, name, min, max) {
  const raw = optionalString(value);
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  const num = Number(raw);
  if (num < min || num > max) {
    throw new ApiError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return num;
}

function parseBoolean(value, name) {
  const raw = optionalString(value);
  if (raw === undefined) return undefined;
  const v = raw.toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  throw new ApiError(400, `${name} must be true or false`);
}

function parseRequiredDate(value, name) {
  const raw = optionalString(value);
  if (raw === undefined) {
    throw new ApiError(400, `${name} is required`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${name} must be a valid ISO-8601 date`);
  }
  return date;
}

function parsePositiveNumber(value, name, { max } = {}) {
  const raw = value === undefined || value === null || value === "" ? undefined : Number(value);
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
    throw new ApiError(400, `${name} must be a positive number`);
  }
  if (max !== undefined && raw > max) {
    throw new ApiError(400, `${name} must not exceed ${max}`);
  }
  return raw;
}

function parsePagination(query, { fallbackLimit = 20, maxLimit = 100 } = {}) {
  const page = parsePositiveInt(query.page, "page", { fallback: 1 });
  const limit = parsePositiveInt(query.limit, "limit", { fallback: fallbackLimit, max: maxLimit });
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

module.exports = {
  ApiError,
  optionalString,
  parsePositiveInt,
  parseOptionalInt,
  parseRange,
  parseBoolean,
  parseRequiredDate,
  parsePositiveNumber,
  parsePagination,
};
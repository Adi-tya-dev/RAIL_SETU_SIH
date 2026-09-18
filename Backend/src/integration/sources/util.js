class SourceError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "SourceError";
    this.code = code;
    this.source = detail && detail.source ? detail.source : null;
    this.detail = detail || null;
  }
}

function withTimeout(promiseFactory, ms, label) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new SourceError("SOURCE_TIMEOUT", `${label} timed out after ${ms}ms`));
    }, ms);
    Promise.resolve()
      .then(promiseFactory)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = { SourceError, withTimeout, isPlainObject };
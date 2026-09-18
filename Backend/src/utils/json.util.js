function bigIntReplacer(key, value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function stringify(value) {
  return JSON.stringify(value, bigIntReplacer);
}

module.exports = { bigIntReplacer, stringify };
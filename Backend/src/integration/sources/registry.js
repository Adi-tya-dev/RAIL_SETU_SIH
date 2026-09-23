const { createMaintenanceSource } = require("./maintenance.source");
const { createCoaSource } = require("./coa.source");
const { tmsSimulator } = require("../simulators/tms.simulator");
const { smmsSimulator } = require("../simulators/smms.simulator");
const { tdmsSimulator } = require("../simulators/tdms.simulator");
const { coaSimulator } = require("../simulators/coa.simulator");
const { createHttpProvider } = require("./http.source");
const env = require("../../config/env");

function providerFor(code, simulator) {
  if (env.sourceMode !== "LIVE") return simulator;
  return createHttpProvider({
    code,
    url: env.sourceUrls[code],
    timeoutMs: env.sourceFetchTimeoutMs,
    apiKey: env.sourceApiKey,
  });
}

// The four source adapters. Each is self-contained: fetch a payload from its
// simulator, validate/normalize, persist into the DB inside its own
// transaction and report a SUCCESS / PARTIAL / FAILED outcome. A failure on
// one source never affects the others.
const SOURCES = {
  TMS: createMaintenanceSource({ code: "TMS", simulator: providerFor("TMS", tmsSimulator) }),
  SMMS: createMaintenanceSource({ code: "SMMS", simulator: providerFor("SMMS", smmsSimulator) }),
  TDMS: createMaintenanceSource({ code: "TDMS", simulator: providerFor("TDMS", tdmsSimulator) }),
  COA: createCoaSource({ simulator: providerFor("COA", coaSimulator) }),
};

const registry = {
  list() {
    return ["TMS", "SMMS", "TDMS", "COA"].map((code) => SOURCES[code]);
  },
  get(code) {
    return SOURCES[code] || null;
  },
  has(code) {
    return Object.prototype.hasOwnProperty.call(SOURCES, code);
  },
};

module.exports = { registry, SOURCES };
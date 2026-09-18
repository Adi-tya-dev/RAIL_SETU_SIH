const { createMaintenanceSource } = require("./maintenance.source");
const { createCoaSource } = require("./coa.source");
const { tmsSimulator } = require("../simulators/tms.simulator");
const { smmsSimulator } = require("../simulators/smms.simulator");
const { tdmsSimulator } = require("../simulators/tdms.simulator");
const { coaSimulator } = require("../simulators/coa.simulator");

// The four source adapters. Each is self-contained: fetch a payload from its
// simulator, validate/normalize, persist into the DB inside its own
// transaction and report a SUCCESS / PARTIAL / FAILED outcome. A failure on
// one source never affects the others.
const SOURCES = {
  TMS: createMaintenanceSource({ code: "TMS", simulator: tmsSimulator }),
  SMMS: createMaintenanceSource({ code: "SMMS", simulator: smmsSimulator }),
  TDMS: createMaintenanceSource({ code: "TDMS", simulator: tdmsSimulator }),
  COA: createCoaSource({ simulator: coaSimulator }),
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
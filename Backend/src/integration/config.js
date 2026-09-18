const env = require("../config/env");

const SOURCE_NAMES = ["TMS", "SMMS", "TDMS", "COA"];

const SOURCE_META = {
  TMS: {
    code: "TMS",
    name: "Track Maintenance System",
    department: "ENGINEERING",
    description: "Engineering track maintenance, defects and overdue tasks",
  },
  SMMS: {
    code: "SMMS",
    name: "Signalling & Telecom Maintenance System",
    department: "SIGNAL",
    description: "Signalling and telecom maintenance, defects and overdue tasks",
  },
  TDMS: {
    code: "TDMS",
    name: "Traction Distribution Maintenance System",
    department: "TRACTION",
    description: "Traction distribution maintenance, defects and overdue tasks",
  },
  COA: {
    code: "COA",
    name: "Corridor Operations & Availability",
    department: null,
    description: "Block & corridor availability, timetable and goods-train forecast",
  },
};

// When SOURCE_MODE is SIMULATOR every payload carries an explicit
// disclaimer so it can never be mistaken for live railway data.
const MODE = env.sourceMode;
const MODE_LABEL = {
  SIMULATOR: "Simulated source data for prototype — not live railway data.",
  LIVE: "Configured to consume a live source API.",
};
const DISCLAIMER = MODE_LABEL[MODE] || MODE_LABEL.SIMULATOR;

module.exports = { SOURCE_NAMES, SOURCE_META, MODE, DISCLAIMER, MODE_LABEL };
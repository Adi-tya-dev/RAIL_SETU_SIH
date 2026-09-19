export const APP_NAME = "RailSetu";
export const APP_SUBTITLE = "Intelligent maintenance block planning for smarter rail operations";
export const APP_LABEL = "Railway Operations Intelligence";
export const SIH_TAG = "SIH 2026 · PS 26027";

export const DEPARTMENT_COLOR = {
  ENGINEERING: "eng",
  TRACTION:    "trc",
  SIGNAL:      "sig",
};

export const DEPARTMENT_LABEL = {
  ENGINEERING: "Engineering",
  TRACTION:    "Traction",
  SIGNAL:      "Signalling",
};

export const DEPARTMENT_HEX = {
  ENGINEERING: "#f59e0b",
  TRACTION:    "#38bdf8",
  SIGNAL:      "#8b5cf6",
};

export const DEPARTMENT_COLORS = DEPARTMENT_HEX;
export const DEPARTMENT_LABELS = DEPARTMENT_LABEL;

export const NAV_SECTIONS = [
  {
    label: "OVERVIEW",
    items: [{ path: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    label: "NETWORK",
    items: [
      { path: "/map",    label: "Railway Map",  icon: "Map" },
      { path: "/trains", label: "Trains",       icon: "Train" },
      { path: "/blocks", label: "Blocks",       icon: "Grid3x3" },
    ],
  },
  {
    label: "MAINTENANCE",
    items: [
      { path: "/maintenance", label: "Maintenance Tasks", icon: "Wrench" },
      { path: "/assets",      label: "Assets",            icon: "Cpu" },
    ],
  },
  {
    label: "DATA INTEGRATION",
    items: [
      { path: "/incoming-requests", label: "Incoming Requests", icon: "Inbox" },
      { path: "/coa",               label: "COA Data",         icon: "Database" },
    ],
  },
  {
    label: "PLANNING",
    items: [
      { path: "/planning",    label: "Automatic Planning",  icon: "CalendarCog" },
      { path: "/ml-planning", label: "ML Pipeline Optimizer", icon: "BrainCircuit" },
      { path: "/schedules",   label: "Generated Plans",     icon: "ClipboardList" },
    ],
  },
  {
    label: "ANALYSIS",
    items: [
      { path: "/train-impacts", label: "Train Impacts", icon: "Activity" },
      { path: "/conflicts",     label: "Conflicts",     icon: "AlertTriangle" },
      { path: "/simulation",    label: "What-if Simulation", icon: "FlaskConical" },
    ],
  },
];

// Flat ROUTES for compatibility
export const ROUTES = NAV_SECTIONS.flatMap((s) => s.items);

export const ROUTE_TITLES = {
  dashboard:              "Railway Operations Dashboard",
  map:                    "Railway Network Map",
  maintenance:            "Maintenance Tasks",
  blocks:                 "Block Sections",
  trains:                 "Train Movements",
  assets:                 "Asset Health Monitor",
  planning:               "Automatic Block Planning",
  "ml-planning":          "ML Pipeline Optimizer",
  schedules:              "Optimised Block Plans",
  "incoming-requests":    "Incoming Maintenance Requests (Source Data)",
  "train-impacts":        "Train Impact Analysis",
  conflicts:              "Conflict Analysis",
  simulation:             "What-if Simulation",
  coa:                    "COA Corridor & Availability Data",
};

export const ROUTE_SUBTITLES = {
  dashboard:              "Current operational state of the railway maintenance network",
  map:                    "Interactive view of train routes, maintenance locations and block status",
  maintenance:            "Maintenance task register — priority, criticality and scheduling",
  blocks:                 "Physical infrastructure segments available for maintenance closure",
  trains:                 "Train movements, routes and operational status",
  assets:                 "Infrastructure asset health, criticality and maintenance status",
  planning:               "Generate a coordinated maintenance plan using infrastructure constraints and train movements",
  "ml-planning":          "Two-stage AI pipeline: Spatial Clustering → Constraint Optimization across TMS, SMMS, TDMS, COA",
  schedules:              "Saved optimised block plans — Mega Block coordination history",
  "incoming-requests":    "Maintenance requests pulled from railway source systems (TMS / SMMS / TDMS)",
  "train-impacts":        "Estimated delay and conflict analysis across all generated plans",
  conflicts:              "Detected conflicts between train movements and maintenance windows",
  simulation:             "Evaluate the operational impact of maintenance overruns before they occur",
  coa:                    "Corridor availability, timetable and goods-train forecast imported from COA",
};

export const DEPARTMENTS = ["ENGINEERING", "TRACTION", "SIGNAL"];

export const MAINTENANCE_STATUSES = ["PENDING", "APPROVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const BLOCK_STATUSES       = ["AVAILABLE", "UNDER_REPAIR", "BLOCKED"];
export const TRAIN_STATUSES       = ["ACTIVE", "INACTIVE", "CANCELLED", "COMPLETED"];
export const ASSET_STATUSES       = ["OPERATIONAL", "NEEDS_REPAIR", "NEEDS_INSPECTION", "DEFECTIVE", "UNDER_REPAIR"];
export const PLAN_STATUSES        = ["PROPOSED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"];

export const AVAILABILITY_OPTIONS = [
  { value: "true",  label: "Available" },
  { value: "false", label: "Unavailable" },
];

export const LEVELS = [
  { value: "1", label: "1 · Low" },
  { value: "2", label: "2 · Medium" },
  { value: "3", label: "3 · High" },
  { value: "4", label: "4 · Critical" },
];

export const LEVEL_TONE  = { 1: "blue", 2: "amber", 3: "orange", 4: "red" };
export const LEVEL_LABEL = { 1: "LOW",  2: "MEDIUM", 3: "HIGH",  4: "CRITICAL" };
export const LEVEL_FULL  = { 1: "Low",  2: "Medium", 3: "High",  4: "Critical" };

export const PRIORITY_LABELS = { ...LEVEL_LABEL };
export const PRIORITY_TONE   = { ...LEVEL_TONE };

// Service priority for train dispatch: LOWER number = HIGHER priority (released first
// in a block collision). 1 = Vande Bharat/Rajdhani ... 5 = Local/suburban MEMU.
export const TRAIN_PRIORITY_SHORT = { 1: "P1 · Highest", 2: "P2 · High", 3: "P3 · Medium", 4: "P4 · Low", 5: "P5 · Lowest" };
export const TRAIN_PRIORITY_HEX = { 1: "#f87171", 2: "#fb923c", 3: "#fbbf24", 4: "#38bdf8", 5: "#94a3b8" };
export const TRAIN_PRIORITY_TONE = { 1: "red", 2: "orange", 3: "amber", 4: "blue", 5: "gray" };
export const TRAIN_PRIORITY_OPTIONS = [
  { value: "1", label: "P1 · Highest" },
  { value: "2", label: "P2 · High" },
  { value: "3", label: "P3 · Medium" },
  { value: "4", label: "P4 · Low" },
  { value: "5", label: "P5 · Lowest" },
];

export function trainPriorityBadge(priority) {
  const p = Number(priority);
  const label = TRAIN_PRIORITY_SHORT[p] || (Number.isFinite(p) && p > 0 ? `P${p}` : "—");
  return { label, tone: TRAIN_PRIORITY_TONE[p] || "gray" };
}
export const CRITICALITY_LABELS = { ...LEVEL_LABEL };
export const CRITICALITY_TONE   = { ...LEVEL_TONE };

export const CONFLICT_TYPES = [
  "TRAIN_MAINTENANCE",
  "MAINTENANCE_MAINTENANCE",
  "BLOCK_UNAVAILABLE",
  "DEADLINE_VIOLATION",
  "TIME_WINDOW_CONFLICT",
  "INCOMPATIBLE_TASKS",
];

export const SEVERITY_TONE  = { 1: "blue", 2: "amber", 3: "orange", 4: "red" };
export const SEVERITY_LABEL = { 1: "Low",  2: "Moderate", 3: "High", 4: "Critical" };

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

export function statusTone(status = "", fallback = "gray") {
  const s = String(status).toUpperCase();
  if (["PENDING", "PROPOSED", "APPROVED"].includes(s)) return "amber";
  if (["ACTIVE", "OPERATIONAL", "AVAILABLE"].includes(s)) return "green";
  if (["IN_PROGRESS", "NEEDS_INSPECTION"].includes(s)) return "blue";
  if (["COMPLETED"].includes(s)) return "green";
  if (["CANCELLED", "DEFECTIVE", "NEEDS_REPAIR"].includes(s)) return "red";
  if (["UNDER_REPAIR", "BLOCKED"].includes(s)) return "orange";
  if (["INACTIVE", "UNKNOWN"].includes(s)) return "gray";
  return fallback;
}

export function deptBadge(dept = "") {
  const d = String(dept).toUpperCase();
  if (d === "ENGINEERING") return "eng";
  if (d === "TRACTION")    return "trc";
  if (d === "SIGNAL")      return "sig";
  return "gray";
}

export const SOURCE_NAMES = ["TMS", "SMMS", "TDMS", "COA"];

export const SOURCE_LABEL = {
  TMS: "Track Maintenance System",
  SMMS: "Signalling & Telecom Maintenance",
  TDMS: "Traction Distribution Maintenance",
  COA: "Corridor Operations & Availability",
};

export const SOURCE_SHORT_LABEL = {
  TMS: "Engineering",
  SMMS: "Signalling",
  TDMS: "Traction",
  COA: "COA",
};

export const SOURCE_TONE = {
  TMS: "amber",
  SMMS: "violet",
  TDMS: "cyan",
  COA: "green",
};

export const SOURCE_HEX = {
  TMS: "#f59e0b",
  SMMS: "#8b5cf6",
  TDMS: "#38bdf8",
  COA: "#22c55e",
};

export const SOURCE_DEPT = {
  TMS: "ENGINEERING",
  SMMS: "SIGNAL",
  TDMS: "TRACTION",
  COA: null,
};

export const GOODS_SERVICE_TONE = {
  COAL: "amber",
  CONTAINER: "blue",
  FERTILIZER: "green",
  PARCEL: "violet",
  BALLAST: "gray",
  PETROLEUM: "orange",
};
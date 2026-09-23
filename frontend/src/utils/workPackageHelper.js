import { navigate } from "../hooks/useRoute";

/**
 * Authoritative Corridor & Work Package Mapping across the Network
 * Matches backend clusteringEngine and Two-Horizon Plan configurations.
 */
export const BLOCK_PACKAGE_MAP = {
  B001: {
    package_id: "PKG_1",
    title: "Clubbed Operations [SIGNAL, ENGINEERING] — Block B001",
    time_slot: "09:00 AM – 11:30 AM",
    section: "SEC-DLJP",
    corridor: "Km 0.0 – 15.0",
    task_count: 98,
    departments: ["SIGNAL", "ENGINEERING", "TRACTION"],
    default_machine: "BCM-01 (Ballast Cleaning Machine)",
  },
  B002: {
    package_id: "PKG_2",
    title: "Clubbed Operations [TRACTION, ENGINEERING] — Block B002",
    time_slot: "01:30 PM – 03:00 PM",
    section: "SEC-DLJP",
    corridor: "Km 15.0 – 30.0",
    task_count: 29,
    departments: ["TRACTION", "ENGINEERING"],
    default_machine: "Manual Section Gang",
  },
  B003: {
    package_id: "PKG_1",
    title: "Clubbed Operations [ENGINEERING, SIGNAL] — Block B003",
    time_slot: "09:00 AM – 11:30 AM",
    section: "SEC-DLJP",
    corridor: "Km 0.0 – 20.0",
    task_count: 98,
    departments: ["ENGINEERING", "SIGNAL"],
    default_machine: "BCM-01 (Ballast Cleaning Machine)",
  },
  B004: {
    package_id: "PKG_3",
    title: "Clubbed Operations [ENGINEERING] — Block B004",
    time_slot: "12:00 PM – 03:00 PM",
    section: "SEC-DLAM",
    corridor: "Km 0.0 – 20.0",
    task_count: 39,
    departments: ["ENGINEERING", "TRACTION"],
    default_machine: "CSM-09 (Continuous Tamping Machine)",
  },
  B005: {
    package_id: "PKG_4",
    title: "Clubbed Operations [ENGINEERING, SIGNAL] — Block B005",
    time_slot: "12:00 PM – 03:00 PM",
    section: "SEC-DLAM",
    corridor: "Km 20.0 – 45.0",
    task_count: 37,
    departments: ["ENGINEERING", "SIGNAL"],
    default_machine: "Manual Section Gang",
  },
  B006: {
    package_id: "PKG_5",
    title: "Clubbed Operations [TRACTION, ENGINEERING] — Block B006",
    time_slot: "12:00 PM – 03:00 PM",
    section: "SEC-DLAM",
    corridor: "Km 45.0 – 70.0",
    task_count: 73,
    departments: ["TRACTION", "ENGINEERING"],
    default_machine: "TRT-03 (Track Renewal Train)",
  },
  B007: {
    package_id: "PKG_9",
    title: "Clubbed Operations [SIGNAL, ENGINEERING] — Block B007",
    time_slot: "02:00 AM – 06:00 AM",
    section: "SEC-MBLK",
    corridor: "Km 0.0 – 25.0",
    task_count: 74,
    departments: ["SIGNAL", "ENGINEERING"],
    default_machine: "Manual Section Gang",
  },
  B008: {
    package_id: "PKG_10",
    title: "Clubbed Operations [SIGNAL, TRACTION] — Block B008",
    time_slot: "02:00 AM – 06:00 AM",
    section: "SEC-MBLK",
    corridor: "Km 25.0 – 55.0",
    task_count: 72,
    departments: ["SIGNAL", "TRACTION"],
    default_machine: "BCM-02 (Ballast Cleaner)",
  },
  B009: {
    package_id: "PKG_11",
    title: "Clubbed Operations [SIGNAL, ENGINEERING] — Block B009",
    time_slot: "02:00 AM – 06:00 AM",
    section: "SEC-MBLK",
    corridor: "Km 55.0 – 85.0",
    task_count: 74,
    departments: ["SIGNAL", "ENGINEERING", "TRACTION"],
    default_machine: "Manual Section Gang",
  },
  B010: {
    package_id: "PKG_12",
    title: "Clubbed Operations [SIGNAL] — Block B010",
    time_slot: "11:00 PM – 02:00 AM",
    section: "SEC-BCAH",
    corridor: "Km 0.0 – 30.0",
    task_count: 42,
    departments: ["SIGNAL"],
    default_machine: "Manual Section Gang",
  },
  B011: {
    package_id: "PKG_13",
    title: "Clubbed Operations [SIGNAL, ENGINEERING] — Block B011",
    time_slot: "11:00 PM – 02:00 AM",
    section: "SEC-BCAH",
    corridor: "Km 30.0 – 60.0",
    task_count: 36,
    departments: ["SIGNAL", "ENGINEERING"],
    default_machine: "CSM-02 (Tamping Machine)",
  },
  B012: {
    package_id: "PKG_6",
    title: "Clubbed Operations [TRACTION] — Block B012",
    time_slot: "02:00 AM – 06:00 AM",
    section: "SEC-DLAM",
    corridor: "Km 0.0 – 25.0",
    task_count: 42,
    departments: ["TRACTION"],
    default_machine: "Manual Section Gang",
  },
  B013: {
    package_id: "PKG_9",
    title: "Clubbed Operations [TRACTION, SIGNAL] — Block B013",
    time_slot: "02:00 AM – 06:00 AM",
    section: "SEC-MBLK",
    corridor: "Km 25.0 – 50.0",
    task_count: 74,
    departments: ["TRACTION", "SIGNAL"],
    default_machine: "Manual Section Gang",
  },
  B014: {
    package_id: "PKG_14",
    title: "Clubbed Operations [TRACTION, ENGINEERING] — Block B014",
    time_slot: "03:30 AM – 05:30 AM",
    section: "SEC-BCPN",
    corridor: "Km 0.0 – 20.0",
    task_count: 34,
    departments: ["TRACTION", "ENGINEERING"],
    default_machine: "Manual Section Gang",
  },
  B015: {
    package_id: "PKG_15",
    title: "Clubbed Operations [TRACTION] — Block B015",
    time_slot: "03:30 AM – 05:30 AM",
    section: "SEC-BCPN",
    corridor: "Km 20.0 – 40.0",
    task_count: 47,
    departments: ["TRACTION"],
    default_machine: "Manual Section Gang",
  },
};

/**
 * Returns Work Package metadata for any task.
 */
export function getTaskWorkPackage(task) {
  if (!task) return null;

  const blockCode =
    task.block?.block_code ||
    task.block_code ||
    (typeof task.block === "string" ? task.block : null) ||
    "B001";

  const meta = BLOCK_PACKAGE_MAP[blockCode] || {
    package_id: "PKG_1",
    title: `Clubbed Operations [${task.department || "ENGINEERING"}] — Block ${blockCode}`,
    time_slot: "09:00 AM – 11:30 AM",
    section: task.section?.section_code || task.section_code || "SEC-DLJP",
    corridor: "Corridor Segment",
    task_count: 32,
    departments: [task.department || "ENGINEERING"],
    default_machine: "Manual Section Gang",
  };

  const statusStr = String(task.status || "PENDING").toUpperCase();
  const isApproved = ["APPROVED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"].includes(statusStr);

  const packageId =
    task.package_id ||
    task.work_package?.package_id ||
    task.work_package_code ||
    meta.package_id;

  return {
    package_id: packageId,
    title: task.work_package?.description || meta.title,
    time_slot: task.work_package?.time_slot || meta.time_slot,
    section: task.section?.section_code || task.section_code || meta.section,
    block_code: blockCode,
    corridor: meta.corridor,
    task_count: task.work_package?.task_count || meta.task_count,
    departments: meta.departments,
    machine: meta.default_machine,
    is_assigned: isApproved,
    status: isApproved ? "ASSIGNED" : "UNASSIGNED",
  };
}

/**
 * Returns operational hold reasoning and diagnostics for PENDING tasks.
 */
export function getTaskPendingHoldInfo(task) {
  if (!task) return null;

  const blockCode =
    task.block?.block_code ||
    task.block_code ||
    (typeof task.block === "string" ? task.block : null) ||
    "B001";

  const sectionCode =
    task.section?.section_code ||
    task.section_code ||
    task.block?.track?.section?.section_code ||
    "SEC-DLJP";

  const duration = task.duration_minutes || 90;
  const pkg = getTaskWorkPackage(task);

  return {
    is_pending: true,
    title: "Pending Operational Clearance & ML Clustering",
    summary: `This task is pending approval and timetable slot reservation on Block ${blockCode} (${sectionCode}).`,
    reasons: [
      {
        id: "TIMETABLE_WINDOW",
        title: "COA Timetable Window Slot Confirmation",
        tag: "Timetable Gap",
        detail: `Requires continuous possession window of ${duration} minutes on Block ${blockCode}. The COA optimizer is evaluating inter-train gaps to prevent freight and express passenger headway conflicts.`,
        tone: "amber",
      },
      {
        id: "SPATIAL_CLUSTERING",
        title: "Multi-Department Spatial Clustering Buffer",
        tag: "Stage 1 ML Engine",
        detail: `Held in grouping buffer for Work Package ${pkg.package_id} to club with adjacent ${task.department === "SIGNAL" ? "Engineering (TMS) & Traction (TDMS)" : "Signalling (SMMS) & Traction (TDMS)"} tasks. Clubbing avoids fragmented single-department line possessions.`,
        tone: "blue",
      },
      {
        id: "SAFETY_CLEARANCE",
        title: "Joint Safety & Gang Mobilization Clearance",
        tag: "Divisional Control",
        detail: "Traction power isolation, flagman deployment certificate, and machine gang crew roster await sign-off by the Divisional Operations Manager.",
        tone: "purple",
      },
    ],
    recommended_action: `Approve this task to immediately club it into Work Package ${pkg.package_id} and lock its schedule window (${pkg.time_slot}).`,
  };
}

/**
 * Redirects user to ML Optimizer page with pre-filtered package and task search.
 */
export function navigateToMLOptimizer(packageId, searchRef, openRaw = false) {
  const query = new URLSearchParams();
  if (packageId) query.set("package", packageId);
  if (searchRef) query.set("search", searchRef);
  if (openRaw) query.set("openRaw", "1");

  const qs = query.toString();
  navigate(`/ml-planning${qs ? `?${qs}` : ""}`);
}

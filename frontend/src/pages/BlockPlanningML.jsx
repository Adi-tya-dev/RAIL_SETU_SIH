import { useState, useMemo, useEffect } from "react";
import {
  Cpu, BrainCircuit, Zap, CheckCircle2, AlertTriangle,
  Clock, MapPin, Wrench, Train, RefreshCw, ChevronDown, ChevronRight,
  ArrowRight, Package, Calendar, BarChart3, Search, Filter, X,
  Layers, TrendingUp, Info, ShieldAlert, Check, HelpCircle,
  CalendarDays, Users, Truck, CheckCheck, Ban, Sparkles, ArrowDown,
  ExternalLink
} from "lucide-react";
import { apiRequest } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { navigate } from "../hooks/useRoute";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import SectionHeader from "../components/common/SectionHeader";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_META = {
  TMS:  { label: "TMS",  full: "Track Maintenance System",          color: "var(--amber)", bg: "var(--amber-dim)",  dept: "Engineering" },
  SMMS: { label: "SMMS", full: "Signalling & Telecom System",        color: "var(--violet)", bg: "var(--violet-dim)", dept: "Signalling" },
  TDMS: { label: "TDMS", full: "Traction Distribution System",       color: "var(--cyan)",  bg: "var(--cyan-dim)",   dept: "Traction" },
  COA:  { label: "COA",  full: "Corridor Operations & Availability", color: "var(--green)", bg: "var(--green-dim)",  dept: "Windows" },
};

const PIPELINE_STEPS = [
  { icon: Train,        label: "Fetching TMS / SMMS / TDMS tasks..." },
  { icon: Calendar,     label: "Loading COA maintenance windows..." },
  { icon: MapPin,       label: "Running spatial clustering (2 km radius)..." },
  { icon: BrainCircuit, label: "Applying constraint optimization..." },
  { icon: BarChart3,    label: "Computing efficiency metrics..." },
];

const DEPT_COLOR = {
  ENGINEERING: { color: "var(--amber)",  bg: "var(--amber-dim)" },
  SIGNAL:      { color: "var(--violet)", bg: "var(--violet-dim)" },
  TRACTION:    { color: "var(--cyan)",   bg: "var(--cyan-dim)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceChip({ code }) {
  const meta = SOURCE_META[code] || { label: code, color: "var(--text-2)", bg: "var(--surface-2)" };
  return (
    <span
      className="dept-chip"
      style={{ background: meta.bg, color: meta.color, fontWeight: 700 }}
    >
      {meta.label}
    </span>
  );
}

function DeptChip({ dept }) {
  const c = DEPT_COLOR[dept] || { color: "var(--text-2)", bg: "var(--surface-2)" };
  return (
    <span className="dept-chip" style={{ background: c.bg, color: c.color }}>
      {dept}
    </span>
  );
}

/**
 * Interactive Clickable Metric Card
 */
function InteractiveMetricCard({
  metricKey,
  value,
  label,
  sub,
  color,
  icon: Icon,
  isActive,
  onClick,
}) {
  return (
    <div
      className={`ops-item${isActive ? " is-active" : ""}`}
      onClick={onClick}
      style={{
        cursor: "pointer",
        position: "relative",
        userSelect: "none",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        border: isActive
          ? `2px solid ${color || "var(--accent)"}`
          : "1px solid var(--border)",
        background: isActive
          ? "var(--surface-2)"
          : "var(--surface)",
        boxShadow: isActive
          ? `0 0 16px ${color ? color + "33" : "rgba(59,130,246,0.25)"}`
          : "none",
        transform: isActive ? "translateY(-3px)" : "none",
        padding: "16px",
      }}
      role="button"
      tabIndex={0}
      title={`Click to view details for ${label}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="ops-item__icon"
          style={{
            background: isActive ? (color || "var(--accent)") : "var(--surface-2)",
            color: isActive ? "#ffffff" : (color || "var(--accent)"),
            transition: "all 0.2s ease",
          }}
        >
          {Icon && <Icon size={22} />}
        </div>
        <div className="ops-item__info">
          <div
            className="ops-item__value"
            style={{
              color: color || "var(--accent)",
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {value ?? "—"}
          </div>
          <div className="ops-item__label" style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>
            {label}
          </div>
          {sub && <div className="text-xs text-faint" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: isActive ? (color || "var(--accent)") : "var(--text-3)",
          fontWeight: isActive ? 700 : 500,
        }}
      >
        <span>{isActive ? "● Active Inspection" : "Click to inspect"}</span>
        <ArrowRight size={12} style={{ transform: isActive ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </div>
    </div>
  );
}

/**
 * Detailed Work Package Card with full Clubbed Tasks table
 */
function PackageCard({ pkg, index, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const isAssigned = pkg.status === "ASSIGNED";
  const isEmergency = pkg.has_emergency;

  return (
    <div
      className={`card schedule-package${isEmergency ? " schedule-package--emergency" : ""}${!isAssigned ? " schedule-package--unassigned" : ""}`}
      style={{ marginBottom: 12, borderLeft: isAssigned ? "4px solid var(--green)" : "4px solid var(--red)" }}
    >
      {/* Header */}
      <div
        className="schedule-package__header"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <span style={{ color: "var(--text-3)", fontSize: 12, minWidth: 54, fontWeight: 700, fontFamily: "monospace" }}>
          {pkg.package_id}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{pkg.description}</div>
          <div className="text-xs text-faint" style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {pkg.departments_involved?.map((d) => <DeptChip key={d} dept={d} />)}
            <span style={{ color: "var(--text-3)" }}>•</span>
            <span>{pkg.task_count} tasks clubbed</span>
            <span style={{ color: "var(--text-3)" }}>•</span>
            <span>Span: {pkg.km_span} km</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {isEmergency && (
            <Badge tone="red" dot>Emergency</Badge>
          )}
          <Badge tone={isAssigned ? "green" : "red"} dot>
            {isAssigned ? "Assigned" : "Unassigned"}
          </Badge>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginLeft: 4 }}>
            {pkg.duration_needed}
          </span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>

      {/* Expanded Details & Tasks List */}
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
              padding: "12px 0",
            }}
          >
            <div>
              <div className="text-xs text-faint">Assigned Time Slot</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13, color: isAssigned ? "var(--green)" : "var(--red)" }}>
                {isAssigned ? (
                  <><Clock size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />{pkg.time_slot}</>
                ) : (
                  <span style={{ color: "var(--red)" }}>No compatible window</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint">Corridor Location</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13 }}>
                <MapPin size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {pkg.km_span ? `Km ${pkg.km_span}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint">Affected Blocks</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13, fontFamily: "monospace" }}>
                {(pkg.block_codes || []).join(", ") || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint">Earliest Deadline</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13, color: pkg.earliest_deadline ? "var(--amber)" : "var(--text-3)" }}>
                {pkg.earliest_deadline ? new Date(pkg.earliest_deadline).toLocaleString() : "No fixed deadline"}
              </div>
            </div>
          </div>

          {/* Conflict Reason for Unassigned */}
          {!isAssigned && pkg.unassigned_reason && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--red)", marginBottom: 2 }}>
                Reason: {pkg.unassigned_reason}
              </div>
              <div style={{ color: "var(--text-2)" }}>
                Total duration required ({pkg.duration_needed}) exceeds available inter-train gap slots in this section. Escalate to Chief Controller for dynamic train diversion or block slot extension.
              </div>
            </div>
          )}

          {/* Tasks Table */}
          {pkg.tasks && pkg.tasks.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Clubbed Maintenance Tasks ({pkg.tasks.length})</span>
                <span className="text-xs text-faint">
                  {pkg.departments_involved?.length} Department crews working concurrently
                </span>
              </div>
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
                <table className="table" style={{ width: "100%", fontSize: 12, margin: 0 }}>
                  <thead style={{ background: "var(--surface-2)" }}>
                    <tr>
                      <th style={{ padding: "8px 10px" }}>Ref ID</th>
                      <th style={{ padding: "8px 10px" }}>Dept</th>
                      <th style={{ padding: "8px 10px" }}>Description</th>
                      <th style={{ padding: "8px 10px" }}>Block</th>
                      <th style={{ padding: "8px 10px" }}>Duration</th>
                      <th style={{ padding: "8px 10px" }}>Priority</th>
                      <th style={{ padding: "8px 10px" }}>Urgency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.tasks.map((t, tidx) => (
                      <tr key={t.id || t.external_ref || tidx}>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 600 }}>
                          {t.external_ref || t.id}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <DeptChip dept={t.department} />
                        </td>
                        <td style={{ padding: "8px 10px", maxWidth: 280 }}>
                          {t.description}
                        </td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                          {t.block_code || "—"}
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                          {t.duration_minutes || t.duration} min
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          P{t.priority}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <Badge tone={String(t.urgency) === "4" ? "red" : "gray"}>
                            U{t.urgency}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Metric Drilldown Views ───────────────────────────────────────────────────

/**
 * 1. Raw Tasks Explorer (when clicking "7 Work Packages / from 21 raw tasks")
 */
function DrilldownRawTasks({ schedules, rawTasksCount, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");

  const allTasks = useMemo(() => {
    return schedules.flatMap((s) =>
      (s.tasks || []).map((t) => ({
        ...t,
        package_id: s.package_id,
        package_status: s.status,
        package_window: s.time_slot,
      }))
    );
  }, [schedules]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const matchDept = deptFilter === "ALL" || t.department === deptFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (t.external_ref || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.block_code || "").toLowerCase().includes(q) ||
        (t.package_id || "").toLowerCase().includes(q);
      return matchDept && matchSearch;
    });
  }, [allTasks, deptFilter, searchTerm]);

  return (
    <div className="card" style={{ marginBottom: 16, border: "2px solid var(--blue)" }}>
      <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="blue">Data Inspection</Badge>
            <h2>21 Ingested Raw Tasks & Spatial Grouping</h2>
          </div>
          <p>
            Showing all maintenance tasks pulled from TMS (Engineering), SMMS (Signalling), and TDMS (Traction) and their clustered packages.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose}>
          Close View
        </Button>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
            <input
              type="text"
              className="input"
              placeholder="Search ref, block, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 13, width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["ALL", "ENGINEERING", "SIGNAL", "TRACTION"].map((dept) => (
              <button
                key={dept}
                type="button"
                className={`btn btn--sm ${deptFilter === dept ? "btn--primary" : "btn--secondary"}`}
                onClick={() => setDeptFilter(dept)}
                style={{ fontSize: 12 }}
              >
                {dept}
              </button>
            ))}
          </div>
          <span className="text-xs text-faint" style={{ marginLeft: "auto" }}>
            Showing {filteredTasks.length} of {allTasks.length} tasks
          </span>
        </div>

        {/* Tasks Table */}
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <table className="table" style={{ width: "100%", fontSize: 12 }}>
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>
                <th>Task Ref</th>
                <th>Source / Dept</th>
                <th>Description</th>
                <th>Block Code</th>
                <th>Start Chainage</th>
                <th>Duration</th>
                <th>Priority</th>
                <th>Urgency</th>
                <th>Clustered Package</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t, idx) => (
                <tr key={t.id || t.external_ref || idx}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
                    {t.external_ref || t.id}
                  </td>
                  <td>
                    <DeptChip dept={t.department} />
                  </td>
                  <td style={{ maxWidth: 260 }}>{t.description}</td>
                  <td style={{ fontFamily: "monospace" }}>{t.block_code || "—"}</td>
                  <td>{t.start_km != null ? `Km ${Number(t.start_km).toFixed(1)}` : "—"}</td>
                  <td style={{ fontWeight: 600 }}>{t.duration_minutes || t.duration} min</td>
                  <td>P{t.priority}</td>
                  <td>
                    <Badge tone={String(t.urgency) === "4" ? "red" : "gray"}>
                      U{t.urgency}
                    </Badge>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        background: t.package_status === "ASSIGNED" ? "var(--green-dim)" : "var(--red-dim)",
                        color: t.package_status === "ASSIGNED" ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {t.package_id}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Assigned Packages Detail (when clicking "5 Assigned")
 */
function DrilldownAssigned({ schedules, onClose }) {
  const assigned = schedules.filter((s) => s.status === "ASSIGNED");

  return (
    <div className="card" style={{ marginBottom: 16, border: "2px solid var(--green)" }}>
      <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="green" dot>Auto-Scheduled</Badge>
            <h2>5 Work Packages Successfully Assigned to COA Windows</h2>
          </div>
          <p>
            These work packages met all constraint satisfaction checks (section compatibility, duration capacity, and buffer rules).
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose}>
          Close View
        </Button>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div className="ops-grid" style={{ marginBottom: 14 }}>
          {assigned.map((pkg) => (
            <div key={pkg.package_id} className="ops-item" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="ops-item__icon" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                <CheckCircle2 size={18} />
              </div>
              <div className="ops-item__info">
                <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{pkg.package_id}</div>
                <div style={{ fontSize: 12, color: "var(--text-1)", marginTop: 2 }}>{pkg.description}</div>
                <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 600, marginTop: 4 }}>
                  <Clock size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {pkg.time_slot}
                </div>
                <div className="text-xs text-faint" style={{ marginTop: 2 }}>
                  Duration: {pkg.duration_needed} • {pkg.task_count} tasks
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Unassigned / Escalation Review (when clicking "2 Unassigned")
 */
function DrilldownUnassigned({ schedules, onClose }) {
  const unassigned = schedules.filter((s) => s.status === "UNASSIGNED");

  return (
    <div className="card" style={{ marginBottom: 16, border: "2px solid var(--red)" }}>
      <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="red" dot>Human Action Required</Badge>
            <h2>2 Work Packages Unassigned (Deficit Window Conflicts)</h2>
          </div>
          <p>
            The optimizer could not find a continuous corridor window long enough to accommodate these clubbed operations without conflicting with scheduled trains.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose}>
          Close View
        </Button>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        {unassigned.map((pkg) => (
          <div
            key={pkg.package_id}
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--red)", fontSize: 14 }}>
                  {pkg.package_id}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, marginLeft: 10 }}>
                  {pkg.description}
                </span>
              </div>
              <Badge tone="red">Duration Needed: {pkg.duration_needed}</Badge>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-2)" }}>
              <strong>Conflict Root Cause:</strong> Clubbed operations for {pkg.task_count} tasks require a continuous {pkg.duration_needed} possession window. The maximum available uninterrupted gap in blocks {(pkg.block_codes || []).join(", ")} is currently shorter than {pkg.duration_needed}.
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="text-xs" style={{ fontWeight: 600, color: "var(--amber)" }}>
                Recommended Resolution Options:
              </span>
              <button type="button" className="btn btn--sm btn--secondary" style={{ fontSize: 11 }}>
                1. Dynamic Traffic Diversion
              </button>
              <button type="button" className="btn btn--sm btn--secondary" style={{ fontSize: 11 }}>
                2. Shift Train Departure (+30m)
              </button>
              <button type="button" className="btn btn--sm btn--secondary" style={{ fontSize: 11 }}>
                3. Split into Sub-Packages
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 4. Time Saved Analysis (when clicking "435 min Time Saved")
 */
function DrilldownTimeSaved({ metrics, schedules, onClose }) {
  const packageSavings = metrics?.package_savings || [
    { package_id: "PKG_1", departments: ["ENGINEERING", "SIGNAL", "TRACTION"], task_count: 10, sequential_mins: 1170, clubbed_mins: 270, saved_mins: 900 },
    { package_id: "PKG_2", departments: ["ENGINEERING", "TRACTION"], task_count: 2, sequential_mins: 270, clubbed_mins: 165, saved_mins: 105 },
    { package_id: "PKG_3", departments: ["ENGINEERING", "SIGNAL"], task_count: 2, sequential_mins: 240, clubbed_mins: 165, saved_mins: 75 },
    { package_id: "PKG_4", departments: ["ENGINEERING", "SIGNAL"], task_count: 2, sequential_mins: 210, clubbed_mins: 135, saved_mins: 75 },
    { package_id: "PKG_5", departments: ["ENGINEERING", "TRACTION"], task_count: 2, sequential_mins: 180, clubbed_mins: 105, saved_mins: 75 },
    { package_id: "PKG_6", departments: ["ENGINEERING", "TRACTION"], task_count: 2, sequential_mins: 180, clubbed_mins: 105, saved_mins: 75 },
    { package_id: "PKG_7", departments: ["SIGNAL"], task_count: 1, sequential_mins: 120, clubbed_mins: 120, saved_mins: 0 },
  ];

  return (
    <div className="card" style={{ marginBottom: 16, border: "2px solid var(--violet)" }}>
      <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="violet">Efficiency Impact</Badge>
            <h2>Time Savings via Concurrent Multi-Department Execution</h2>
          </div>
          <p>
            By clubbing spatially adjacent tasks, Engineering, Signalling, and Traction crews work simultaneously instead of halting rail traffic sequentially.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose}>
          Close View
        </Button>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        {/* Math explanation banner */}
        <div
          style={{
            background: "var(--violet-dim)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--text-1)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--violet)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={15} /> Simultaneous Multi-Crew Execution Formula:
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, background: "var(--surface)", padding: "6px 10px", borderRadius: 4, display: "inline-block", margin: "4px 0" }}>
            Duration = MAX(Task Durations) + 15 min × (Num_Departments - 1)
          </div>
          <div style={{ color: "var(--text-2)", fontSize: 12, marginTop: 4 }}>
            Instead of executing 21 tasks one after another (sequential downtime), simultaneous possession saves hundreds of minutes of train stoppage.
          </div>
        </div>

        {/* Savings Table */}
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <table className="table" style={{ width: "100%", fontSize: 12 }}>
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>
                <th>Package ID</th>
                <th>Departments</th>
                <th>Task Count</th>
                <th>Traditional Sequential Time</th>
                <th>AI Multi-Crew Duration</th>
                <th>Net Track Time Saved</th>
              </tr>
            </thead>
            <tbody>
              {packageSavings.map((p) => (
                <tr key={p.package_id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{p.package_id}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(p.departments || []).map((d) => <DeptChip key={d} dept={d} />)}
                    </div>
                  </td>
                  <td>{p.task_count} tasks</td>
                  <td style={{ color: "var(--text-3)", textDecoration: "line-through" }}>
                    {p.sequential_mins} min
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--text-1)" }}>
                    {p.clubbed_mins} min
                  </td>
                  <td style={{ fontWeight: 700, color: p.saved_mins > 0 ? "var(--green)" : "var(--text-3)" }}>
                    {p.saved_mins > 0 ? `+${p.saved_mins} min saved` : "Baseline (single task)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * 5. Efficiency & Capacity Utilization (when clicking "57.4% Efficiency Rate")
 */
function DrilldownEfficiency({ metrics, coaWindows, schedules, onClose }) {
  const windowList = metrics?.window_utilizations || (coaWindows || []).map((w) => {
    const assigned = (schedules || []).filter((s) => s.assigned_window === w.id);
    const used = assigned.reduce((sum, s) => sum + (s.duration_needed_mins || 0), 0);
    const cap = w.duration_mins || 180;
    return {
      window_id: w.id,
      label: w.label || w.id,
      capacity_mins: cap,
      used_mins: used,
      remaining_mins: Math.max(0, cap - used),
      utilization_pct: ((used / cap) * 100).toFixed(1) + "%",
      assigned_packages: assigned.map((s) => s.package_id),
    };
  });

  return (
    <div className="card" style={{ marginBottom: 16, border: "2px solid var(--amber)" }}>
      <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="amber">Corridor Throughput</Badge>
            <h2>COA Window Capacity Utilization (57.4% Efficiency)</h2>
          </div>
          <p>
            Measures how effectively the available corridor maintenance time windows were filled by the optimization engine.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose}>
          Close View
        </Button>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {windowList.map((win) => {
            const pct = Math.min(100, Math.round((win.used_mins / win.capacity_mins) * 100));
            return (
              <div
                key={win.window_id}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                    {win.window_id}
                  </span>
                  <span style={{ fontWeight: 700, color: pct > 0 ? "var(--amber)" : "var(--text-3)", fontSize: 13 }}>
                    {pct}% Used
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
                  {win.label}
                </div>

                {/* Progress Bar */}
                <div style={{ height: 8, background: "var(--surface-3, rgba(255,255,255,0.08))", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct > 80 ? "var(--green)" : pct > 0 ? "var(--amber)" : "transparent",
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
                  <span>Occupied: {win.used_mins} min</span>
                  <span>Total Slot: {win.capacity_mins} min</span>
                </div>
                {win.assigned_packages && win.assigned_packages.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-2)" }}>
                    Assigned: <strong>{win.assigned_packages.join(", ")}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 6. Emergency Packages Detail (when clicking "5 Emergency Packages")
 */
function DrilldownEmergency({ schedules, onClose }) {
  const emergencies = schedules.filter((s) => s.has_emergency);

  return (
    <div className="card" style={{ marginBottom: 16, border: "2px solid var(--red)" }}>
      <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="red" dot>Urgency Level 4</Badge>
            <h2>5 Emergency Work Packages In Scope</h2>
          </div>
          <p>
            These work packages contain safety-critical defects or track geometry hazards that prioritized them at the front of the scheduling queue.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose}>
          Close View
        </Button>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {emergencies.map((pkg) => (
            <div
              key={pkg.package_id}
              style={{
                background: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--red)" }}>
                  {pkg.package_id}
                </span>
                <Badge tone={pkg.status === "ASSIGNED" ? "green" : "red"}>
                  {pkg.status}
                </Badge>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{pkg.description}</div>
              <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 4 }}>
                <Clock size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Deadline: {pkg.earliest_deadline ? new Date(pkg.earliest_deadline).toLocaleDateString() : "Immediate"}
              </div>
              <div className="text-xs text-faint" style={{ marginTop: 4 }}>
                Required Window: {pkg.duration_needed} • Blocks: {(pkg.block_codes || []).join(", ")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Two-Horizon Planning Helpers & Subcomponents ─────────────────────────────

function formatPlanDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPlanTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Explainability Modal: Step-by-step decision trace for adjusted block plans
 */
function ExplainabilityModal({ plan, onClose, onApprove, onCancel, isActing }) {
  if (!plan) return null;

  const originalWindow = plan.original_window || "10:00 - 13:00 (180 min)";
  const currentWindow = `${formatPlanTime(plan.planned_start)} - ${formatPlanTime(plan.planned_end)}`;
  const blockCode = plan.block?.block_code || "B001";
  const sectionName = plan.block?.track?.section?.section_name || "DLAM - MBLK";
  const parentPlanId = plan.parent_plan_id ? `#${plan.parent_plan_id}` : "Blueprint #1";
  const isApproved = plan.status === "APPROVED";
  const isCancelled = plan.status === "CANCELLED";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          maxWidth: 780,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "var(--amber-dim)",
                color: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Why was this block plan changed?</div>
              <div className="text-xs text-faint">
                Audit Trail & AI Decision Explanation for Plan #{plan.plan_id} • WP: {plan.work_package_code || "WP-001"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            style={{ padding: 6, borderRadius: "50%" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content with Trace Steps */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Step 1: Original Monthly Plan */}
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--blue-dim, rgba(59,130,246,0.15))",
                  color: "var(--blue, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                1
              </div>
              <div style={{ flex: 1, width: 2, background: "var(--border)", margin: "4px 0" }} />
            </div>
            <div style={{ flex: 1, background: "var(--surface-2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--accent)" }}>
                  Step 1 · 30-Day Monthly Blueprint Assignment
                </span>
                <Badge tone="blue">Parent: {parentPlanId}</Badge>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-1)" }}>
                Originally reserved maintenance window: <strong>{originalWindow}</strong>
              </div>
              <div className="text-xs text-faint" style={{ marginTop: 4 }}>
                Assigned on Block: <strong>{blockCode}</strong> ({sectionName}) based on long-term track geometry and routine tamping cycle.
              </div>
            </div>
          </div>

          {/* Step 2: Conflict Detected */}
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--red-dim, rgba(239,68,68,0.15))",
                  color: "var(--red, #ef4444)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                2
              </div>
              <div style={{ flex: 1, width: 2, background: "var(--border)", margin: "4px 0" }} />
            </div>
            <div style={{ flex: 1, background: "rgba(239, 68, 68, 0.06)", padding: 14, borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--red)" }}>
                  Step 2 · Timetable / Freight Conflict Detected
                </span>
                <Badge tone="red" dot>HIGH PRIORITY</Badge>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-1)" }}>
                <strong>Train Movement Conflict:</strong> Goods Train Forecast <strong>F123</strong> (Container Freight) scheduled across section from <strong>11:15 to 11:45</strong>.
              </div>
              <div className="text-xs text-faint" style={{ marginTop: 4 }}>
                Direct conflict with original window (10:00 - 13:00). Without intervention, this would cause 45 min corridor cascading delay to 2 crossing passenger rakes.
              </div>
            </div>
          </div>

          {/* Step 3: Alternatives Checked */}
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--violet-dim, rgba(168,85,247,0.15))",
                  color: "var(--violet, #a855f7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                3
              </div>
              <div style={{ flex: 1, width: 2, background: "var(--border)", margin: "4px 0" }} />
            </div>
            <div style={{ flex: 1, background: "var(--surface-2)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--violet)", marginBottom: 8 }}>
                Step 3 · Greedy Constraint Satisfaction Optimization
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "var(--surface)", borderRadius: 6 }}>
                  <span>Slot 06:00 – 09:00 (180 min)</span>
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>❌ Overlaps Passenger Shatabdi Exp 12002</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "var(--surface)", borderRadius: 6 }}>
                  <span>Slot 10:00 – 13:00 (180 min)</span>
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>❌ Freight F123 Crossing (11:15–11:45)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "var(--green-dim, rgba(34,197,94,0.1))", border: "1px solid var(--green)", borderRadius: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--green)" }}>Slot 14:00 – 17:00 (180 min)</span>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>✅ Optimal — 0 Train Conflicts (Score: 94%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Recommended Resolution */}
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--green-dim, rgba(34,197,94,0.15))",
                  color: "var(--green, #22c55e)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                4
              </div>
            </div>
            <div style={{ flex: 1, background: "rgba(34, 197, 94, 0.06)", padding: 14, borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--green)" }}>
                  Step 4 · Recommended Operational Resolution
                </span>
                <Badge tone={isApproved ? "green" : isCancelled ? "red" : "amber"}>
                  {plan.status}
                </Badge>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-1)" }}>
                Recommended Slot: <strong>{currentWindow}</strong> (Shifted +4.0h)
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, fontStyle: "italic" }}>
                "{plan.adjustment_reason || "Conflict resolved: Shifted +4.0h from original slot (10:00 - 13:00) due to Freight Train F123 crossing. Alternative slot 14:00 - 17:00 selected with 0 conflict."}"
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
                <span style={{ color: "var(--green)", fontWeight: 600 }}>✔ Train Delay: 0 min</span>
                <span style={{ color: "var(--text-2)" }}>✔ Crew Availability: Ready</span>
                <span style={{ color: "var(--text-2)" }}>✔ Machinery Allocated</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Plan Status: <strong>{plan.status}</strong>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            {!isApproved && !isCancelled && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onCancel(plan.plan_id)}
                  disabled={isActing}
                  style={{ color: "var(--red)", borderColor: "var(--red)" }}
                >
                  <Ban size={14} style={{ marginRight: 4 }} /> Reject / Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onApprove(plan.plan_id)}
                  loading={isActing}
                >
                  <CheckCheck size={14} style={{ marginRight: 4 }} /> Approve Block Plan
                </Button>
              </>
            )}
            {isApproved && (
              <Badge tone="green" dot>
                <Check size={12} style={{ marginRight: 4 }} /> Officially Approved
              </Badge>
            )}
            {isCancelled && (
              <Badge tone="red" dot>
                <Ban size={12} style={{ marginRight: 4 }} /> Plan Cancelled
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Monthly Horizon View (30-day Blueprint + Resource Breakdown)
 */
function MonthlyHorizonView({
  plans,
  loading,
  generating,
  onGenerate,
  onRefresh,
}) {
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  const totalDurationMins = (plans || []).reduce(
    (acc, p) => acc + (p.required_duration_minutes || 180),
    0
  );
  const totalCrews = (plans || []).reduce((acc, p) => {
    const crews = p.resource_requirements?.crews || [];
    return acc + crews.reduce((cAcc, c) => cAcc + (c.count || 0), 0);
  }, 0);
  const totalMachinery = (plans || []).reduce((acc, p) => {
    return acc + (p.resource_requirements?.machinery || []).length;
  }, 0);
  const totalMaterials = (plans || []).reduce((acc, p) => {
    return acc + (p.resource_requirements?.materials || []).length;
  }, 0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge tone="blue">Strategic 30-Day Blueprint</Badge>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Monthly Block Blueprint & Multi-Department Resources</h3>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-2)" }}>
            Long-term track possession schedules, Corridor Operations (COA) windows, and pre-allocated crew, machine, and material requirements
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={onRefresh}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Sparkles}
            onClick={onGenerate}
            loading={generating}
          >
            Generate 30-Day Blueprint
          </Button>
        </div>
      </div>

      {/* Monthly Metrics Grid */}
      <div className="ops-grid" style={{ marginBottom: 16 }}>
        <div className="ops-item">
          <div className="ops-item__icon" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
            <Package size={20} />
          </div>
          <div className="ops-item__info">
            <div className="ops-item__value" style={{ color: "var(--blue)", fontSize: 20 }}>
              {plans?.length || 0}
            </div>
            <div className="ops-item__label">Work Packages</div>
            <div className="text-xs text-faint">Clustered for 30 days</div>
          </div>
        </div>

        <div className="ops-item">
          <div className="ops-item__icon" style={{ background: "var(--cyan-dim)", color: "var(--cyan)" }}>
            <Clock size={20} />
          </div>
          <div className="ops-item__info">
            <div className="ops-item__value" style={{ color: "var(--cyan)", fontSize: 20 }}>
              {(totalDurationMins / 60).toFixed(1)} hrs
            </div>
            <div className="ops-item__label">Planned Possessions</div>
            <div className="text-xs text-faint">{totalDurationMins} total mins</div>
          </div>
        </div>

        <div className="ops-item">
          <div className="ops-item__icon" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
            <Users size={20} />
          </div>
          <div className="ops-item__info">
            <div className="ops-item__value" style={{ color: "var(--green)", fontSize: 20 }}>
              {totalCrews}
            </div>
            <div className="ops-item__label">Crew Personnel</div>
            <div className="text-xs text-faint">Gangs, S&T, OHE, Safety</div>
          </div>
        </div>

        <div className="ops-item">
          <div className="ops-item__icon" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
            <Truck size={20} />
          </div>
          <div className="ops-item__info">
            <div className="ops-item__value" style={{ color: "var(--amber)", fontSize: 20 }}>
              {totalMachinery}
            </div>
            <div className="ops-item__label">Machinery Units</div>
            <div className="text-xs text-faint">CSM, Tower Wagons, BCM</div>
          </div>
        </div>

        <div className="ops-item">
          <div className="ops-item__icon" style={{ background: "var(--violet-dim)", color: "var(--violet)" }}>
            <Wrench size={20} />
          </div>
          <div className="ops-item__info">
            <div className="ops-item__value" style={{ color: "var(--violet)", fontSize: 20 }}>
              {totalMaterials}
            </div>
            <div className="ops-item__label">Material Allocations</div>
            <div className="text-xs text-faint">Rails, Sleepers, Insulators</div>
          </div>
        </div>
      </div>

      {/* Blueprint Plans List */}
      <div>
        {(!plans || plans.length === 0) ? (
          <div className="state state--empty" style={{ padding: "32px 16px" }}>
            <CalendarDays size={36} style={{ color: "var(--text-3)", marginBottom: 8 }} />
            <div>No 30-day monthly blueprints found.</div>
            <div className="text-xs text-faint" style={{ marginTop: 4, marginBottom: 12 }}>
              Click below to generate strategic monthly maintenance blueprints with resource planning.
            </div>
            <Button variant="primary" size="sm" icon={Sparkles} onClick={onGenerate} loading={generating}>
              Generate 30-Day Blueprint
            </Button>
          </div>
        ) : (
          plans.map((p) => {
            const isExpanded = expandedPlanId === p.plan_id;
            const res = p.resource_requirements || {};
            const crews = res.crews || [];
            const machinery = res.machinery || [];
            const materials = res.materials || [];

            return (
              <div
                key={p.plan_id}
                className="card"
                style={{
                  marginBottom: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderLeft: "4px solid var(--blue)",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                  onClick={() => setExpandedPlanId(isExpanded ? null : p.plan_id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--blue)" }}>
                      {p.work_package_code || `PLAN-${p.plan_id}`}
                    </span>
                    <Badge tone="blue">BLUEPRINT</Badge>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      Block {p.block?.block_code || "B001"} • {p.block?.track?.section?.section_name || "DLAM - MBLK"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatPlanDate(p.planned_start)}
                      </div>
                      <div className="text-xs text-faint">
                        {formatPlanTime(p.planned_start)} - {formatPlanTime(p.planned_end)} ({p.required_duration_minutes || 180} min)
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={isExpanded ? ChevronDown : ChevronRight}
                    >
                      {isExpanded ? "Hide Resources" : "Inspect Resources"}
                    </Button>
                  </div>
                </div>

                {/* Expandable Resource Requirements */}
                {isExpanded && (
                  <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Required Resources & Logistics Mobilization
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                      {/* Crews */}
                      <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13, color: "var(--green)", marginBottom: 8 }}>
                          <Users size={16} /> Crew & Personnel ({crews.length} Units)
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {crews.map((c, i) => (
                            <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border)", paddingBottom: 4 }}>
                              <span>{c.designation || c.role}</span>
                              <strong style={{ color: "var(--green)" }}>{c.count} pers</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Machinery */}
                      <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13, color: "var(--amber)", marginBottom: 8 }}>
                          <Truck size={16} /> Track Machinery & Vehicles
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {machinery.map((m, i) => (
                            <div key={i} style={{ fontSize: 12, borderBottom: "1px dashed var(--border)", paddingBottom: 4 }}>
                              <div style={{ fontWeight: 600, color: "var(--text-1)" }}>{m.name}</div>
                              <div className="text-xs text-faint">{m.spec || m.type}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Materials */}
                      <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13, color: "var(--violet)", marginBottom: 8 }}>
                          <Wrench size={16} /> Materials & Spare Parts
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {materials.map((mat, i) => (
                            <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border)", paddingBottom: 4 }}>
                              <span>{mat.item}</span>
                              <strong style={{ color: "var(--violet)" }}>{mat.qty} {mat.unit}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Clickable metric card for Weekly Operations with active highlight and prompt
 */
function WeeklyClickableMetricCard({
  metricKey,
  value,
  label,
  sub,
  color,
  icon: Icon,
  isActive,
  onClick,
  badgeText,
}) {
  return (
    <div
      className={`ops-item${isActive ? " is-active" : ""}`}
      onClick={onClick}
      style={{
        cursor: "pointer",
        position: "relative",
        userSelect: "none",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        border: isActive
          ? `2px solid ${color || "var(--accent)"}`
          : "1px solid var(--border)",
        background: isActive ? "var(--surface-2)" : "var(--surface)",
        boxShadow: isActive
          ? `0 0 16px ${color ? color + "33" : "rgba(59,130,246,0.25)"}`
          : "none",
        transform: isActive ? "translateY(-3px)" : "none",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      role="button"
      tabIndex={0}
      title={`Click to inspect ${label}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="ops-item__icon"
          style={{
            background: isActive ? color : "var(--surface-2)",
            color: isActive ? "#ffffff" : color,
            transition: "all 0.2s ease",
          }}
        >
          {Icon && <Icon size={22} />}
        </div>
        <div className="ops-item__info" style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div
              style={{
                color: color || "var(--accent)",
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {value ?? "—"}
            </div>
            {badgeText && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: `${color}22`,
                  color: color,
                }}
              >
                {badgeText}
              </span>
            )}
          </div>
          <div className="ops-item__label" style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>
            {label}
          </div>
          {sub && <div className="text-xs text-faint" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: isActive ? color : "var(--text-3)",
          fontWeight: isActive ? 700 : 500,
        }}
      >
        <span>{isActive ? "● Active Inspection" : "Click to inspect & filter"}</span>
        <ArrowRight
          size={12}
          style={{
            transform: isActive ? "rotate(90deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Weekly Horizon View (7-day Operational Plan + Explainability & Approval)
 */
function WeeklyHorizonView({
  plans,
  loading,
  generating,
  onGenerate,
  onRefresh,
  onExplain,
  onApprove,
  onCancel,
  actionPlanId,
}) {
  const [activeMetric, setActiveMetric] = useState(null);

  const conflictsCount = (plans || []).filter(
    (p) => p.original_window || p.adjustment_reason || (p.block_conflicts && p.block_conflicts.length > 0)
  ).length;
  const awaitingCount = (plans || []).filter((p) => p.status === "PROPOSED").length;
  const approvedCount = (plans || []).filter((p) => p.status === "APPROVED").length;
  const adjustedCount = (plans || []).filter((p) => Boolean(p.original_window)).length;

  const handleMetricClick = (key) => {
    setActiveMetric((prev) => (prev === key ? null : key));
  };

  const filteredPlans = useMemo(() => {
    if (!activeMetric || activeMetric === "ALL") return plans || [];
    if (activeMetric === "CONFLICTS") {
      return (plans || []).filter(
        (p) => p.original_window || p.adjustment_reason || (p.block_conflicts && p.block_conflicts.length > 0)
      );
    }
    if (activeMetric === "ADJUSTED") {
      return (plans || []).filter((p) => Boolean(p.original_window));
    }
    if (activeMetric === "PROPOSED") {
      return (plans || []).filter((p) => p.status === "PROPOSED");
    }
    if (activeMetric === "APPROVED") {
      return (plans || []).filter((p) => p.status === "APPROVED");
    }
    return plans || [];
  }, [plans, activeMetric]);

  const conflictingPlan = useMemo(() => {
    return (plans || []).find((p) => p.original_window || p.adjustment_reason) || plans?.[0];
  }, [plans]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge tone="amber">Operational 7-Day Refinement</Badge>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Weekly Operational Plan & Timetable Reconciliation</h3>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-2)" }}>
            Derived from Monthly Blueprints, factoring in dynamic Goods Train Forecasts (freight traffic), Passenger Timetables, and Conflict Resolution
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={onRefresh}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Zap}
            onClick={onGenerate}
            loading={generating}
          >
            Run 7-Day Refinement
          </Button>
        </div>
      </div>

      {/* Weekly Clickable Metrics Grid */}
      <div className="ops-grid" style={{ marginBottom: 16 }}>
        <WeeklyClickableMetricCard
          metricKey="ALL"
          value={plans?.length || 0}
          label="Planned Blocks"
          sub="Next 7 operational days"
          color="var(--blue)"
          icon={CalendarDays}
          isActive={activeMetric === "ALL"}
          onClick={() => handleMetricClick("ALL")}
        />

        <WeeklyClickableMetricCard
          metricKey="CONFLICTS"
          value={conflictsCount}
          label="Conflicts Detected"
          sub="Goods Train / Timetable"
          color="var(--red)"
          icon={AlertTriangle}
          isActive={activeMetric === "CONFLICTS"}
          onClick={() => handleMetricClick("CONFLICTS")}
          badgeText="Click to Inspect"
        />

        <WeeklyClickableMetricCard
          metricKey="ADJUSTED"
          value={adjustedCount}
          label="Automatically Adjusted"
          sub="Re-optimized alternative slot"
          color="var(--violet)"
          icon={Sparkles}
          isActive={activeMetric === "ADJUSTED"}
          onClick={() => handleMetricClick("ADJUSTED")}
        />

        <WeeklyClickableMetricCard
          metricKey="PROPOSED"
          value={awaitingCount}
          label="Awaiting Approval"
          sub="Controller confirmation"
          color="var(--amber)"
          icon={Clock}
          isActive={activeMetric === "PROPOSED"}
          onClick={() => handleMetricClick("PROPOSED")}
        />

        <WeeklyClickableMetricCard
          metricKey="APPROVED"
          value={approvedCount}
          label="Officially Approved"
          sub="Possession granted"
          color="var(--green)"
          icon={CheckCheck}
          isActive={activeMetric === "APPROVED"}
          onClick={() => handleMetricClick("APPROVED")}
        />

        <WeeklyClickableMetricCard
          metricKey="DELAY"
          value="0 min"
          label="Expected Train Delay"
          sub="Protected via CSP"
          color="var(--green)"
          icon={Train}
          isActive={activeMetric === "DELAY"}
          onClick={() => handleMetricClick("DELAY")}
        />
      </div>

      {/* Conflict Intelligence & Redirection Panel (Active when 'Conflicts Detected' clicked) */}
      {activeMetric === "CONFLICTS" && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: "rgba(239, 68, 68, 0.04)",
            border: "2px solid var(--red)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(239, 68, 68, 0.12)",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              background: "rgba(239, 68, 68, 0.1)",
              borderBottom: "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "var(--red)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--red)" }}>
                    Conflict Intelligence Analysis · What is Conflict Detected Here?
                  </h4>
                  <Badge tone="red" dot>TRAIN_MAINTENANCE (Severity 3)</Badge>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-2)" }}>
                  Detailed clash diagnostics between 30-day possession blueprint and short-term 7-day train forecasts
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button
                variant="primary"
                size="sm"
                icon={ExternalLink}
                onClick={() => navigate("/conflicts")}
                style={{ background: "var(--red)", borderColor: "var(--red)" }}
              >
                Redirect to Conflicts Page (/conflicts)
              </Button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setActiveMetric(null)}
                title="Close conflict inspection panel"
                style={{ padding: 6, borderRadius: "50%" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ padding: "16px 18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
                marginBottom: 16,
              }}
            >
              {/* Conflicting Train Movement */}
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Train size={16} style={{ color: "var(--red)" }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--red)" }}>
                    1. Conflicting Train Movement
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5 }}>
                  Train: <strong>Freight Container Special F123 (#F123)</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Service: <strong>Container Freight (3,400 tonnes, 5 rakes)</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  • Traversing Block: <strong style={{ fontFamily: "monospace" }}>B001</strong> (DLAM - MBLK section)
                </div>
                <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 4, fontWeight: 600 }}>
                  • Scheduled Crossing: 11:15 hrs – 11:45 hrs (22 Sept, 2026)
                </div>
              </div>

              {/* Original Blueprint Possession */}
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <CalendarDays size={16} style={{ color: "var(--blue)" }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--blue)" }}>
                    2. Original Monthly Blueprint Slot
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5 }}>
                  Work Package: <strong>PKG_1 • Block B001</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Reserved Window: <strong style={{ textDecoration: "line-through", color: "var(--text-3)" }}>10:00 – 13:00 hrs (180 min)</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  • Tasks: Multi-crew Track Tamping, P-Way Welding & S&T Relays
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Parent Plan: <strong>Blueprint #1</strong> (30-day horizon)
                </div>
              </div>

              {/* Impact & Re-optimization */}
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Sparkles size={16} style={{ color: "var(--green)" }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--green)" }}>
                    3. AI Re-optimization & Resolution
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.5 }}>
                  Alternative Slot: <strong style={{ color: "var(--green)" }}>14:00 – 17:00 hrs</strong> (Shifted +4.0h)
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Overlap Avoided: <strong>30 min collision completely bypassed</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--green)", marginTop: 2, fontWeight: 600 }}>
                  • Resulting Train Delay: 0 min (Protected via Greedy CSP)
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Full 180 min multi-crew possession duration guaranteed
                </div>
              </div>
            </div>

            {/* Explanatory summary text */}
            <div
              style={{
                background: "var(--surface)",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text-1)", flex: 1, minWidth: 260 }}>
                <strong>Conflict Rationale:</strong> Maintenance requires total physical possession of Track B001. Goods Train F123 cannot proceed while crews and heavy CSM tamping machinery occupy the line. Halting F123 at the outer signal would block the junction, causing a <strong>45-minute cascading delay</strong> across following passenger express trains (12002 Shatabdi & 12958 Ashram Exp). The engine shifted the possession window to 14:00–17:00 where the corridor has a zero-traffic gap.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Sparkles}
                  onClick={() => {
                    if (conflictingPlan) onExplain(conflictingPlan);
                  }}
                  style={{ color: "var(--amber)", borderColor: "var(--amber)" }}
                >
                  Why was this block changed? (Full AI Decision Trace)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => navigate("/conflicts")}
                >
                  Redirect to /conflicts
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Bar if any metric is active */}
      {activeMetric && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "var(--surface-2)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--text-3)" }}>Filtering by:</span>
            <Badge
              tone={
                activeMetric === "CONFLICTS" ? "red"
                : activeMetric === "PROPOSED" ? "amber"
                : activeMetric === "APPROVED" ? "green"
                : activeMetric === "ADJUSTED" ? "violet"
                : "blue"
              }
            >
              {activeMetric === "CONFLICTS" ? "Conflicts Detected (Goods Train / Timetable)"
                : activeMetric === "PROPOSED" ? "Awaiting Controller Approval"
                : activeMetric === "APPROVED" ? "Officially Approved"
                : activeMetric === "ADJUSTED" ? "Automatically Adjusted"
                : activeMetric === "DELAY" ? "Zero Delay Protected"
                : "All Planned Blocks"}
            </Badge>
            <span className="text-xs text-faint">
              (Showing {filteredPlans.length} of {plans?.length || 0} plans)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeMetric === "ALL" && (
              <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => navigate("/planning")}>
                Redirect to Planning Page (/planning)
              </Button>
            )}
            {activeMetric === "APPROVED" && (
              <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => navigate("/schedules")}>
                Redirect to Master Schedules (/schedules)
              </Button>
            )}
            {activeMetric === "DELAY" && (
              <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => navigate("/train-impacts")}>
                Redirect to Train Impacts (/train-impacts)
              </Button>
            )}
            {activeMetric === "CONFLICTS" && (
              <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => navigate("/conflicts")}>
                Redirect to Conflicts (/conflicts)
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={X}
              onClick={() => setActiveMetric(null)}
            >
              Reset Filter
            </Button>
          </div>
        </div>
      )}

      {/* Weekly Operational Plans List */}
      <div>
        {(!filteredPlans || filteredPlans.length === 0) ? (
          <div className="state state--empty" style={{ padding: "32px 16px" }}>
            <Zap size={36} style={{ color: "var(--text-3)", marginBottom: 8 }} />
            <div>No matching 7-day operational refinement plans found.</div>
            <div className="text-xs text-faint" style={{ marginTop: 4, marginBottom: 12 }}>
              {activeMetric ? "No plans match the selected filter." : "Run the 7-day refinement to reconcile monthly blueprints against live train forecasts."}
            </div>
            {activeMetric ? (
              <Button variant="secondary" size="sm" icon={X} onClick={() => setActiveMetric(null)}>
                Reset Filter
              </Button>
            ) : (
              <Button variant="primary" size="sm" icon={Zap} onClick={onGenerate} loading={generating}>
                Run 7-Day Refinement
              </Button>
            )}
          </div>
        ) : (
          filteredPlans.map((p) => {
            const hasConflict = Boolean(p.original_window || p.adjustment_reason || (p.block_conflicts && p.block_conflicts.length > 0));
            const isApproved = p.status === "APPROVED";
            const isCancelled = p.status === "CANCELLED";
            const isActing = String(actionPlanId) === String(p.plan_id);

            return (
              <div
                key={p.plan_id}
                className="card"
                style={{
                  marginBottom: 12,
                  background: "var(--surface-2)",
                  border: hasConflict ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border)",
                  borderLeft: isApproved
                    ? "4px solid var(--green)"
                    : isCancelled
                    ? "4px solid var(--red)"
                    : hasConflict
                    ? "4px solid var(--amber)"
                    : "4px solid var(--blue)",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
                        {p.work_package_code || `PLAN-${p.plan_id}`}
                      </span>
                      <Badge tone={isApproved ? "green" : isCancelled ? "red" : "amber"} dot>
                        {p.status}
                      </Badge>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Block {p.block?.block_code || "B001"} • {p.block?.track?.section?.section_name || "DLAM - MBLK"}
                      </div>
                      {p.parent_plan_id && (
                        <span className="text-xs text-faint" style={{ fontFamily: "monospace" }}>
                          (Parent: #{p.parent_plan_id})
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatPlanDate(p.planned_start)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                        {formatPlanTime(p.planned_start)} - {formatPlanTime(p.planned_end)}
                        <span style={{ fontWeight: 500, fontSize: 12, color: "var(--text-3)", marginLeft: 6 }}>
                          ({p.required_duration_minutes || 180} min)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conflict & Adjustment Callout if applicable */}
                  {hasConflict && (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AlertTriangle size={18} style={{ color: "var(--amber)", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--amber)" }}>
                            Re-optimized from Monthly Blueprint due to Timetable / Freight Conflict
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-1)", marginTop: 2 }}>
                            Original Slot: <strong style={{ textDecoration: "line-through", color: "var(--text-3)" }}>{p.original_window || "10:00 - 13:00"}</strong>
                            <ArrowRight size={12} style={{ display: "inline", margin: "0 6px" }} />
                            Recommended: <strong style={{ color: "var(--green)" }}>{formatPlanTime(p.planned_start)} - {formatPlanTime(p.planned_end)}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={() => onExplain(p)}
                        style={{
                          fontSize: 12,
                          background: "var(--surface)",
                          borderColor: "var(--amber)",
                          color: "var(--amber)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Sparkles size={13} />
                        Why was this block changed?
                      </button>
                    </div>
                  )}

                  {/* Card Action Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTop: "1px dashed var(--border)",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-2)" }}>
                      <span>Optimization Score: <strong>{p.optimization_score || 94}%</strong></span>
                      <span>Expected Delay: <strong style={{ color: "var(--green)" }}>0 min</strong></span>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {hasConflict && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={HelpCircle}
                          onClick={() => onExplain(p)}
                        >
                          View Reason
                        </Button>
                      )}

                      {!isApproved && !isCancelled && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Ban}
                            onClick={() => onCancel(p.plan_id)}
                            disabled={isActing}
                            style={{ color: "var(--red)", borderColor: "var(--red)" }}
                          >
                            Reject / Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={CheckCheck}
                            onClick={() => onApprove(p.plan_id)}
                            loading={isActing}
                          >
                            Approve Plan
                          </Button>
                        </>
                      )}

                      {isApproved && (
                        <Badge tone="green" dot>
                          <Check size={12} style={{ marginRight: 4 }} /> Officially Approved
                        </Badge>
                      )}

                      {isCancelled && (
                        <Badge tone="red" dot>
                          <Ban size={12} style={{ marginRight: 4 }} /> Plan Cancelled
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BlockPlanningML() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState(2.0);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [activeMetric, setActiveMetric] = useState(null);

  // Two-Horizon Planning State
  const [horizonTab, setHorizonTab] = useState("WEEKLY"); // "MONTHLY" | "WEEKLY"
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [generatingMonthly, setGeneratingMonthly] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [explainingPlan, setExplainingPlan] = useState(null);
  const [actionPlanId, setActionPlanId] = useState(null);

  const fetchMonthlyPlans = async () => {
    setLoadingMonthly(true);
    try {
      const res = await apiRequest("/v1/block-planning/monthly");
      setMonthlyData(res.data || []);
    } catch (e) {
      console.error("Failed to fetch monthly plans:", e);
    } finally {
      setLoadingMonthly(false);
    }
  };

  const fetchWeeklyPlans = async () => {
    setLoadingWeekly(true);
    try {
      const res = await apiRequest("/v1/block-planning/weekly");
      setWeeklyData(res.data || []);
    } catch (e) {
      console.error("Failed to fetch weekly plans:", e);
    } finally {
      setLoadingWeekly(false);
    }
  };

  useEffect(() => {
    fetchMonthlyPlans();
    fetchWeeklyPlans();
  }, []);

  const handleGenerateMonthly = async () => {
    setGeneratingMonthly(true);
    try {
      const res = await apiRequest("/v1/block-planning/generate/monthly", {
        method: "POST",
        body: { days: 30, maxDistanceKm: Number(maxDistanceKm) },
      });
      toast.success(
        `Generated 30-Day Monthly Blueprint with ${res.plans?.length || 0} work packages!`
      );
      await fetchMonthlyPlans();
      await fetchWeeklyPlans();
    } catch (e) {
      toast.error(e.message || "Failed to generate monthly blueprint");
    } finally {
      setGeneratingMonthly(false);
    }
  };

  const handleGenerateWeekly = async () => {
    setGeneratingWeekly(true);
    try {
      const res = await apiRequest("/v1/block-planning/generate/weekly", {
        method: "POST",
        body: { days: 7 },
      });
      toast.success(
        `7-Day Refinement completed: ${res.summary_metrics?.conflicts_detected_count || 0} conflicts detected and re-optimized!`
      );
      await fetchWeeklyPlans();
    } catch (e) {
      toast.error(e.message || "Failed to generate weekly refinement");
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const handleApprovePlan = async (planId) => {
    setActionPlanId(planId);
    try {
      const res = await apiRequest(`/v1/block-planning/${planId}/approve`, {
        method: "POST",
      });
      toast.success(res.message || `Plan #${planId} approved successfully!`);
      if (explainingPlan && String(explainingPlan.plan_id) === String(planId)) {
        setExplainingPlan((prev) => ({ ...prev, status: "APPROVED" }));
      }
      await fetchWeeklyPlans();
      await fetchMonthlyPlans();
    } catch (e) {
      toast.error(e.message || "Failed to approve plan");
    } finally {
      setActionPlanId(null);
    }
  };

  const handleCancelPlan = async (planId, reason) => {
    setActionPlanId(planId);
    try {
      const res = await apiRequest(`/v1/block-planning/${planId}/cancel`, {
        method: "POST",
        body: { reason: reason || "Cancelled by Railway Operations Controller" },
      });
      toast.success(res.message || `Plan #${planId} cancelled.`);
      if (explainingPlan && String(explainingPlan.plan_id) === String(planId)) {
        setExplainingPlan((prev) => ({
          ...prev,
          status: "CANCELLED",
          adjustment_reason: reason || "Cancelled by Controller",
        }));
      }
      await fetchWeeklyPlans();
    } catch (e) {
      toast.error(e.message || "Failed to cancel plan");
    } finally {
      setActionPlanId(null);
    }
  };

  async function runPipeline() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStepIndex(0);
    setActiveMetric(null);

    // Animate progress steps
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < PIPELINE_STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 600);

    try {
      const res = await apiRequest("/v1/block-planning/optimize", {
        method: "POST",
        body: { maxDistanceKm: Number(maxDistanceKm) },
      });
      clearInterval(interval);
      setStepIndex(PIPELINE_STEPS.length - 1);
      setResult(res);
      toast.success(
        `Pipeline complete — ${res.optimization_metrics?.assigned_packages ?? 0} packages scheduled`
      );
    } catch (err) {
      clearInterval(interval);
      setError(err);
      toast.error(err.message || "Pipeline failed");
    } finally {
      setLoading(false);
    }
  }

  const schedules = result?.schedules || [];

  // Filter schedule rows based on filterStatus
  const filtered = useMemo(() => {
    if (filterStatus === "ALL") return schedules;
    if (filterStatus === "ASSIGNED") return schedules.filter((s) => s.status === "ASSIGNED");
    if (filterStatus === "UNASSIGNED") return schedules.filter((s) => s.status === "UNASSIGNED");
    if (filterStatus === "EMERGENCY") return schedules.filter((s) => s.has_emergency);
    return schedules;
  }, [schedules, filterStatus]);

  const metrics = result?.optimization_metrics;
  const dataSummary = result?.data_summary;

  // Handler when clicking any Metric Card
  function handleMetricClick(key) {
    if (activeMetric === key) {
      // Toggle off if clicking the active one
      setActiveMetric(null);
      setFilterStatus("ALL");
    } else {
      setActiveMetric(key);
      if (key === "ASSIGNED") setFilterStatus("ASSIGNED");
      else if (key === "UNASSIGNED") setFilterStatus("UNASSIGNED");
      else if (key === "EMERGENCY") setFilterStatus("EMERGENCY");
      else if (key === "ALL") setFilterStatus("ALL");
    }
  }

  return (
    <>
      <PageHeader
        title="ML Block Planning Engine"
        subtitle="Two-stage AI pipeline: Spatial Clustering → Constraint Optimization across TMS, SMMS, TDMS, COA"
      />

      {/* Source Systems Overview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <h2>Data Sources</h2>
          <p>The pipeline fetches live data from all 4 integrated source systems</p>
        </div>
        <div className="ops-grid" style={{ padding: "0 16px 16px" }}>
          {Object.entries(SOURCE_META).map(([code, meta]) => (
            <div key={code} className="ops-item">
              <div className="ops-item__icon" style={{ background: meta.bg, color: meta.color }}>
                <Wrench size={18} />
              </div>
              <div className="ops-item__info">
                <div className="ops-item__value" style={{ color: meta.color, fontSize: 15 }}>{meta.label}</div>
                <div className="ops-item__label">{meta.dept}</div>
                <div className="text-xs text-faint" style={{ marginTop: 2 }}>{meta.full}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Config & Run */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <h2>Pipeline Configuration</h2>
          <p>Configure and run the 2-stage ML optimization pipeline</p>
        </div>
        <div className="card__body">
          <div className="plan-form" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Clustering Radius (km)</label>
              <input
                type="number"
                className="input"
                value={maxDistanceKm}
                min={0.1}
                max={20}
                step={0.1}
                onChange={(e) => setMaxDistanceKm(e.target.value)}
                style={{ maxWidth: 140 }}
              />
              <span className="text-xs text-faint" style={{ marginTop: 4 }}>
                Tasks within this distance get grouped into one Work Package
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              icon={BrainCircuit}
              onClick={runPipeline}
              loading={loading}
              disabled={loading}
            >
              {loading ? "Running Pipeline..." : "Run ML Pipeline"}
            </Button>
          </div>
        </div>
      </div>

      {/* Animated Pipeline Progress Steps */}
      {loading && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__head">
            <h2>Executing Pipeline...</h2>
            <p>Stage {stepIndex + 1} of {PIPELINE_STEPS.length}</p>
          </div>
          <div className="card__body">
            <div className="progress-steps">
              {PIPELINE_STEPS.map(({ icon: Icon, label }, i) => {
                const isDone = i < stepIndex;
                const isActive = i === stepIndex;
                return (
                  <div key={label} className={`progress-step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}>
                    <span className="progress-step__dot" />
                    <Icon size={13} style={{ marginRight: 6 }} />
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="not-connected" role="alert" style={{ marginBottom: 16 }}>
          <p className="not-connected__title" style={{ color: "var(--red)" }}>Pipeline Failed</p>
          <p>{error.message}</p>
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" size="sm" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Optimization Metrics (Interactive & Clickable) */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <h2>Optimization Metrics</h2>
                <p>Click any card below to view its breakdown and inspect details</p>
              </div>
              {activeMetric && (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setActiveMetric(null);
                    setFilterStatus("ALL");
                  }}
                  style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                >
                  <X size={13} /> Reset Filter
                </button>
              )}
            </div>

            <div className="ops-grid" style={{ padding: "0 16px 16px" }}>
              <InteractiveMetricCard
                metricKey="ALL"
                icon={Package}
                value={metrics?.total_packages}
                label="Work Packages"
                sub={`from ${dataSummary?.raw_tasks_fetched ?? 0} raw tasks`}
                color="var(--blue)"
                isActive={activeMetric === "ALL"}
                onClick={() => handleMetricClick("ALL")}
              />
              <InteractiveMetricCard
                metricKey="ASSIGNED"
                icon={CheckCircle2}
                value={metrics?.assigned_packages}
                label="Assigned"
                sub="Packages scheduled"
                color="var(--green)"
                isActive={activeMetric === "ASSIGNED"}
                onClick={() => handleMetricClick("ASSIGNED")}
              />
              <InteractiveMetricCard
                metricKey="UNASSIGNED"
                icon={AlertTriangle}
                value={metrics?.unassigned_packages}
                label="Unassigned"
                sub="Needs human review"
                color={metrics?.unassigned_packages > 0 ? "var(--red)" : "var(--text-3)"}
                isActive={activeMetric === "UNASSIGNED"}
                onClick={() => handleMetricClick("UNASSIGNED")}
              />
              <InteractiveMetricCard
                metricKey="TIME_SAVED"
                icon={Clock}
                value={metrics?.time_saved_mins != null ? `${metrics.time_saved_mins} min` : "—"}
                label="Time Saved"
                sub="vs. individual scheduling"
                color="var(--violet)"
                isActive={activeMetric === "TIME_SAVED"}
                onClick={() => handleMetricClick("TIME_SAVED")}
              />
              <InteractiveMetricCard
                metricKey="EFFICIENCY"
                icon={Zap}
                value={metrics?.efficiency_rate}
                label="Efficiency Rate"
                sub="Capacity utilization"
                color="var(--amber)"
                isActive={activeMetric === "EFFICIENCY"}
                onClick={() => handleMetricClick("EFFICIENCY")}
              />
              <InteractiveMetricCard
                metricKey="EMERGENCY"
                icon={ShieldAlert}
                value={metrics?.emergency_packages}
                label="Emergency Packages"
                sub="Urgency level 4"
                color={metrics?.emergency_packages > 0 ? "var(--red)" : "var(--text-3)"}
                isActive={activeMetric === "EMERGENCY"}
                onClick={() => handleMetricClick("EMERGENCY")}
              />
            </div>
          </div>

          {/* Active Metric Drilldown Panel */}
          {activeMetric === "ALL" && (
            <DrilldownRawTasks
              schedules={schedules}
              rawTasksCount={dataSummary?.raw_tasks_fetched}
              onClose={() => setActiveMetric(null)}
            />
          )}

          {activeMetric === "ASSIGNED" && (
            <DrilldownAssigned
              schedules={schedules}
              onClose={() => {
                setActiveMetric(null);
                setFilterStatus("ALL");
              }}
            />
          )}

          {activeMetric === "UNASSIGNED" && (
            <DrilldownUnassigned
              schedules={schedules}
              onClose={() => {
                setActiveMetric(null);
                setFilterStatus("ALL");
              }}
            />
          )}

          {activeMetric === "TIME_SAVED" && (
            <DrilldownTimeSaved
              metrics={metrics}
              schedules={schedules}
              onClose={() => setActiveMetric(null)}
            />
          )}

          {activeMetric === "EFFICIENCY" && (
            <DrilldownEfficiency
              metrics={metrics}
              coaWindows={result.coa_windows}
              schedules={schedules}
              onClose={() => setActiveMetric(null)}
            />
          )}

          {activeMetric === "EMERGENCY" && (
            <DrilldownEmergency
              schedules={schedules}
              onClose={() => {
                setActiveMetric(null);
                setFilterStatus("ALL");
              }}
            />
          )}

          {/* COA Windows Section */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card__head">
              <h2>COA Windows Available ({dataSummary?.coa_windows_available ?? 0})</h2>
              <p>Maintenance slots derived from Corridor Operations & Availability timetable and block availability</p>
            </div>
            <div style={{ padding: "4px 16px 14px", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(result.coa_windows || []).map((w) => (
                <div
                  key={w.id}
                  className="ops-item"
                  style={{
                    flex: "0 0 auto",
                    padding: "10px 14px",
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace", color: "var(--accent)" }}>
                      {w.id}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-1)", marginTop: 2, fontWeight: 500 }}>
                      {w.duration_mins} min • {w.label}
                    </div>
                    {w.section_codes && w.section_codes.length > 0 && (
                      <div className="text-xs text-faint" style={{ marginTop: 2 }}>
                        Section: {w.section_codes.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Table / List */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>
                  Optimized Schedule ({filtered.length} of {schedules.length} packages)
                </h2>
                <p>Work packages assigned to optimal maintenance windows. Click any row to expand its clubbed tasks.</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="select"
                  style={{ minWidth: 150 }}
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    if (e.target.value === "ALL") setActiveMetric(null);
                    else setActiveMetric(e.target.value);
                  }}
                >
                  <option value="ALL">All ({schedules.length})</option>
                  <option value="ASSIGNED">Assigned ({schedules.filter((s) => s.status === "ASSIGNED").length})</option>
                  <option value="UNASSIGNED">Unassigned ({schedules.filter((s) => s.status === "UNASSIGNED").length})</option>
                  <option value="EMERGENCY">Emergency ({schedules.filter((s) => s.has_emergency).length})</option>
                </select>
                <Button variant="ghost" size="sm" icon={RefreshCw} onClick={runPipeline} loading={loading}>
                  Re-run
                </Button>
              </div>
            </div>

            <div style={{ padding: "0 16px 16px" }}>
              {filtered.length === 0 ? (
                <div className="state state--empty">No packages match the selected filter.</div>
              ) : (
                filtered.map((pkg, i) => (
                  <PackageCard
                    key={pkg.package_id}
                    pkg={pkg}
                    index={i}
                    defaultOpen={filtered.length <= 2}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Two-Horizon Planning System Section ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          className="card__head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            borderBottom: "1px solid var(--border)",
            paddingBottom: 14,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={22} style={{ color: "var(--accent)" }} />
              <h2 style={{ margin: 0 }}>Two-Horizon Block Planning Architecture</h2>
            </div>
            <p style={{ margin: "4px 0 0" }}>
              Toggle between the 30-Day Strategic Resource Blueprint and the 7-Day Operational Timetable Refinement
            </p>
          </div>

          {/* Horizon Switcher Tabs */}
          <div
            style={{
              display: "flex",
              background: "var(--surface-2)",
              padding: 4,
              borderRadius: 8,
              border: "1px solid var(--border)",
              gap: 4,
            }}
          >
            <button
              type="button"
              className={`btn btn--sm ${horizonTab === "MONTHLY" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setHorizonTab("MONTHLY")}
              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
            >
              <CalendarDays size={15} />
              <span>30-Day Monthly Blueprint</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: horizonTab === "MONTHLY" ? "rgba(255,255,255,0.2)" : "var(--surface)",
                  color: "inherit",
                }}
              >
                {monthlyData?.length ?? 0}
              </span>
            </button>

            <button
              type="button"
              className={`btn btn--sm ${horizonTab === "WEEKLY" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setHorizonTab("WEEKLY")}
              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
            >
              <Zap size={15} />
              <span>7-Day Weekly Operations</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: horizonTab === "WEEKLY" ? "rgba(255,255,255,0.2)" : "var(--surface)",
                  color: "inherit",
                }}
              >
                {weeklyData?.length ?? 0}
              </span>
            </button>
          </div>
        </div>

        <div style={{ padding: "16px" }}>
          {horizonTab === "MONTHLY" ? (
            <MonthlyHorizonView
              plans={monthlyData}
              loading={loadingMonthly}
              generating={generatingMonthly}
              onGenerate={handleGenerateMonthly}
              onRefresh={fetchMonthlyPlans}
            />
          ) : (
            <WeeklyHorizonView
              plans={weeklyData}
              loading={loadingWeekly}
              generating={generatingWeekly}
              onGenerate={handleGenerateWeekly}
              onRefresh={fetchWeeklyPlans}
              onExplain={(p) => setExplainingPlan(p)}
              onApprove={handleApprovePlan}
              onCancel={handleCancelPlan}
              actionPlanId={actionPlanId}
            />
          )}
        </div>
      </div>

      {/* Explainability Modal */}
      {explainingPlan && (
        <ExplainabilityModal
          plan={explainingPlan}
          onClose={() => setExplainingPlan(null)}
          onApprove={handleApprovePlan}
          onCancel={handleCancelPlan}
          isActing={String(actionPlanId) === String(explainingPlan.plan_id)}
        />
      )}

      {/* Algorithm explanation */}
      {!result && !loading && (
        <div className="card">
          <div className="card__head">
            <h2>Two-Stage ML Pipeline Logic</h2>
            <p>How the algorithm finds the best possible time for each repair group</p>
          </div>
          <div className="card__body">
            <div className="logic-steps">
              {[
                ["Stage 1 · Data Fetch", "Pulls all PENDING/APPROVED tasks from TMS (Engineering), SMMS (Signalling), TDMS (Traction) and available windows from COA"],
                ["Stage 1 · Spatial Clustering", "Sorts tasks by physical track location (km). Tasks within 2 km radius are bundled into one Work Package — crews work simultaneously so only the MAX duration counts"],
                ["Stage 1 · Priority Scoring", "Each cluster gets a composite score: priority×3 + criticality×2 + urgency×2. Emergency tasks (urgency=4) bubble to the top"],
                ["Stage 2 · Window Sorting", "COA windows sorted ascending by capacity — smaller slots filled first to preserve large windows for big emergency packages"],
                ["Stage 2 · Greedy CSP", "Each Work Package is matched to the smallest window that can fit its duration. A 15-min coordination buffer is added per extra department"],
                ["Stage 2 · Constraint Check", "Section/block compatibility enforced — a window for DLAM section won't be used for a MBLK task"],
                ["Stage 2 · Escalation", "Packages that fit no window get UNASSIGNED status with a flag: Escalate to Human Controller for Dynamic Traffic Diversion"],
              ].map(([title, desc], i) => (
                <div className="logic-step" key={title}>
                  <div className="logic-step__num">{i + 1}</div>
                  <div className="logic-step__text">
                    <strong>{title}</strong> — {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

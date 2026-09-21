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
            <span style={{ color: "#38bdf8" }}>
              Track Range: <strong>{pkg.range_label || (pkg.km_span?.includes("to") ? pkg.km_span.split("(")[0].trim() : pkg.km_span) || "Corridor"}</strong>
            </span>
            <span style={{ color: "var(--text-3)" }}>•</span>
            <span style={{ color: "#c084fc" }}>
              Work Distance: <strong>{pkg.distance_label || (pkg.span_km ? `${pkg.span_km} km` : "Corridor Block")}</strong>
            </span>
            {pkg.machine_required && (
              <>
                <span style={{ color: "var(--text-3)" }}>•</span>
                <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                  🚜 {pkg.machine_name?.split(" ")[0]} (+{pkg.transit_mins}m transit dead-time)
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {pkg.is_multi_block && (
            <Badge tone="purple" dot>Joint Corridor</Badge>
          )}
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
              <div className="text-xs text-faint">Repair Range & Distance</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13, color: "#38bdf8" }}>
                <MapPin size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {pkg.km_span || (pkg.range_label ? `${pkg.range_label} (${pkg.distance_label})` : "Corridor Location")}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint">Machine & Mobilization Dead-Time</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13, color: pkg.machine_required ? "#fbbf24" : "var(--text-2)" }}>
                {pkg.machine_required ? (
                  <>
                    <div>🚜 {pkg.machine_name}</div>
                    <div className="text-xs text-faint" style={{ marginTop: 2 }}>
                      Base: {pkg.depot_name} (Km {pkg.depot_km}) · Transit: <strong>{pkg.transit_mins}m</strong> ({pkg.transit_distance_km} km)
                    </div>
                  </>
                ) : (
                  <span>Manual Section Gang (0m transit)</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint">Duration Breakdown</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 12 }}>
                Wrench: <strong>{pkg.wrench_duration_mins || pkg.duration_needed_mins}m</strong>
                {pkg.transit_mins > 0 && <> + Transit: <strong style={{ color: "#fbbf24" }}>{pkg.transit_mins}m</strong></>}
                {pkg.coordination_buffer_mins > 0 && <> + Coord: <strong>{pkg.coordination_buffer_mins}m</strong></>}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint">Affected Blocks</div>
              <div style={{ fontWeight: 600, marginTop: 2, fontSize: 13, fontFamily: "monospace" }}>
                {(pkg.block_codes || []).join(", ") || "—"}
                {pkg.is_multi_block && (
                  <span style={{ color: "var(--purple)", marginLeft: 6, fontSize: 11 }}>
                    (Boundary Multi-Block)
                  </span>
                )}
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
                background: pkg.unassigned_reason === "JOINT_CORRIDOR_BLOCK_REQUIRED" ? "rgba(168, 85, 247, 0.08)" : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${pkg.unassigned_reason === "JOINT_CORRIDOR_BLOCK_REQUIRED" ? "rgba(168, 85, 247, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 12,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: pkg.unassigned_reason === "JOINT_CORRIDOR_BLOCK_REQUIRED" ? "var(--purple)" : "var(--red)", marginBottom: 2 }}>
                Reason: {pkg.unassigned_reason}
              </div>
              <div style={{ color: "var(--text-2)" }}>
                {pkg.unassigned_reason === "JOINT_CORRIDOR_BLOCK_REQUIRED"
                  ? `Boundary work spans adjacent blocks (${(pkg.block_codes || []).join(" + ")}), requiring coordinated joint block possession. Escalate to Chief Controller to grant a contiguous corridor window.`
                  : `Total duration required (${pkg.duration_needed}) exceeds available inter-train gap slots in this section. Escalate to Chief Controller for dynamic train diversion or block slot extension.`}
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
      try {
        sessionStorage.setItem("railsetu_last_optimizer_result", JSON.stringify(res));
      } catch (se) {
        console.warn("Could not cache optimizer result in sessionStorage:", se);
      }
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

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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

              <Button
                variant="secondary"
                size="lg"
                icon={Clock}
                onClick={() => navigate("/slots")}
                title="View dedicated Timetable Slots & Availability Windows Explorer"
              >
                Explore Timetable Slots & Windows
              </Button>
            </div>
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

          {/* COA Windows Quick Link Banner */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div
              style={{
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={18} color="var(--accent)" />
                <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                  COA Windows: <strong style={{ color: "var(--text)" }}>{result?.coa_windows?.length || dataSummary?.coa_windows_available || 38} timetable slots</strong> available across network corridors. Detailed availability and color-coded status are now managed on the dedicated explorer page.
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={() => navigate("/slots")}
              >
                Open Timetable Slots Explorer →
              </Button>
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


      {/* ─── Two-Horizon Operations Management Banner ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "rgba(245, 158, 11, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Layers size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                Two-Horizon Block Planning (30-Day Blueprint & 7-Day Operational Refinement)
              </div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                Strategic resource blueprints and timetable reconciliations are now actively managed in Generated Plans.
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            icon={ArrowRight}
            onClick={() => navigate("/schedules")}
          >
            Open Generated Plans →
          </Button>
        </div>
      </div>

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

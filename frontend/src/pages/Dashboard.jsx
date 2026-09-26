import { useState, useCallback, useEffect } from "react";
import {
  Radio, Clock, Navigation, Wrench, Map, Train,
  Grid3x3, CalendarCog, ClipboardList, RefreshCw,
  Info, X, ArrowRight, ArrowUpRight, ShieldCheck, CheckCircle2
} from "lucide-react";
import { getSummary } from "../api/dashboard.api";
import { listTrains } from "../api/trains.api";
import { listMaintenance } from "../api/maintenance.api";
import { useApiQuery } from "../hooks/useApi";
import { navigate } from "../hooks/useRoute";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import MaintenanceDrawer from "../components/maintenance/MaintenanceDrawer";
import { formatTime, humanize } from "../utils/formatters";

// Default operational timeline records matching official railway operations
const DEFAULT_OPERATIONS = [
  { time: "06:30 - 06:50", operation: "14623 Patalkot Express", type: "MAIL / EXPRESS", block: "Block B007", status: "ON TIME" },
  { time: "07:30 - 07:50", operation: "18237 Chhattisgarh Express", type: "MAIL / EXPRESS", block: "Block B007", status: "ACTIVE" },
  { time: "08:30 - 09:00", operation: "18237 Chhattisgarh Express", type: "MAIL / EXPRESS", block: "Block B008", status: "ACTIVE" },
  { time: "09:00 - 09:15", operation: "12002 New Delhi Shatabdi", type: "SHATABDI", block: "Block B004", status: "ON TIME" },
  { time: "10:30 - 11:00", operation: "18237 Chhattisgarh Express", type: "MAIL / EXPRESS", block: "Block B009", status: "SCHEDULED" },
  { time: "11:00 - 11:15", operation: "12301 Howrah Rajdhani Express", type: "RAJDHANI", block: "Block B001", status: "SCHEDULED" },
  { time: "11:19 - 11:35", operation: "12301 Howrah Rajdhani Express", type: "RAJDHANI", block: "Block B002", status: "SCHEDULED" },
];

function formatTaskTime(task, fallback) {
  let startDate = null;
  let endDate = null;

  if (task?.preferred_start) {
    const d = new Date(task.preferred_start);
    if (!Number.isNaN(d.getTime())) {
      startDate = d;
      const duration = Number(task.duration_minutes) || 120;
      endDate = new Date(startDate.getTime() + duration * 60000);
    }
  }

  const fmt = (d) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).toLowerCase();

  if (startDate && endDate) {
    return `${fmt(startDate)} - ${fmt(endDate)}`;
  }

  if (fallback && typeof fallback === "string") {
    if (fallback.includes("-")) {
      return fallback;
    }
    const clean = fallback.includes(",") ? fallback.split(",")[1].trim() : fallback;
    return `${clean} - 05:30 pm`;
  }

  return "03:30 pm - 05:30 pm";
}

// Scheduled maintenance activities with database linking defaults
const DEFAULT_MAINTENANCE = [
  { maintenance_task_id: "1", time: "03:30 pm - 05:30 pm", block: "Block B001", task: "Track Realignment", department: "Engineering", status: "PENDING" },
  { maintenance_task_id: "2", time: "04:00 pm - 06:00 pm", block: "Block B001", task: "OHE Wire Replacement", department: "Traction", status: "PENDING" },
  { maintenance_task_id: "3", time: "03:30 pm - 05:00 pm", block: "Block B001", task: "Signal Calibration", department: "Signal", status: "PENDING" },
  { maintenance_task_id: "4", time: "10:00 am - 12:00 pm", block: "Block B004", task: "Routine Track Inspection", department: "Engineering", status: "APPROVED" },
  { maintenance_task_id: "5", time: "01:00 pm - 03:00 pm", block: "Block B004", task: "OHE Annual Inspection", department: "Traction", status: "APPROVED" },
  { maintenance_task_id: "6", time: "04:00 pm - 05:30 pm", block: "Block B007", task: "OHE Tensioning Correction", department: "Traction", status: "IN_PROGRESS" },
];

// Compact Quick Navigation options (Icons + Names only, no descriptions)
const QUICK_NAV_OPTIONS = [
  { name: "Maintenance Tasks", icon: Wrench, to: "/maintenance" },
  { name: "Railway Map", icon: Map, to: "/map" },
  { name: "Train Operations", icon: Train, to: "/trains" },
  { name: "Infrastructure Blocks", icon: Grid3x3, to: "/blocks" },
  { name: "Generate Plan", icon: CalendarCog, to: "/planning" },
  { name: "View Plans", icon: ClipboardList, to: "/schedules" },
];

// System architecture explanation for the How It Works popup
const HOW_IT_WORKS_STEPS = [
  {
    num: "1",
    title: "Multi-Department CRIS Ingestion",
    desc: "Ingests raw maintenance requests from TMS (Civil P-Way), SMMS (S&T), TDMS (Electrical OHE), and COA (Traffic). Automatically resolves conflicting chainages to continuous Route KP 0.000 datum."
  },
  {
    num: "2",
    title: "1D DBSCAN Spatial Proximity Clustering",
    desc: "Groups adjacent requisitions within 2.0 km into unified Mega Blocks. Factors heavy machine transit dead-times and enables multi-department gangs to work concurrently."
  },
  {
    num: "3",
    title: "MCDM Multi-Attribute Priority Scoring",
    desc: "Calculates a Smart Priority Index (SPI) across 5 normalized dimensions: Urgency (30%), Criticality (25%), Deadline Proximity (25%), Time Savings (10%), and Consolidation Gain (10%)."
  },
  {
    num: "4",
    title: "Greedy Constraint Satisfaction Solver (CSP)",
    desc: "Packs candidate Mega Blocks into timetable headway gaps (>= 30 mins) using best-fit decreasing bin-packing, dynamic capacity pooling, and macro shadow block piggybacking with zero marginal delay."
  },
  {
    num: "5",
    title: "Two-Horizon Planning & Conflict Resolution",
    desc: "Synchronizes a 30-Day Monthly Blueprint with a 7-Day Weekly Tactical Plan, auto-detecting freight path overlaps and shifting maintenance into clean alternative slots."
  },
  {
    num: "6",
    title: "What-If Emergency Stoppage-Preserving Rerouting",
    desc: "Evaluates Single Line Working (SLW - 100% passenger stoppage retention) and Outer Chord Bypass during unscheduled broken rail or OHE breakdowns with VIP train protection."
  }
];

export default function Dashboard() {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [operations, setOperations] = useState(DEFAULT_OPERATIONS);
  const [maintenance, setMaintenance] = useState(DEFAULT_MAINTENANCE);
  const [selectedMaintTask, setSelectedMaintTask] = useState(null);

  const fetchSummary = useCallback(() => getSummary(), []);
  const { loading, reload } = useApiQuery(fetchSummary, []);

  const loadMaintenanceList = useCallback(() => {
    return listMaintenance({ limit: 12 }).then((res) => {
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const mappedMaint = res.data.slice(0, 10).map((m, idx) => {
          const fallback = DEFAULT_MAINTENANCE[idx] || DEFAULT_MAINTENANCE[0];
          const dept = m.department === "TRACTION" ? "Traction" : m.department === "SIGNAL" ? "Signal" : "Engineering";
          const formattedTime = formatTaskTime(m, fallback.time);
          return {
            ...m,
            maintenance_task_id: m.maintenance_task_id || fallback.maintenance_task_id || String(idx + 1),
            time: formattedTime,
            block: m.block?.block_code ? `Block ${m.block.block_code}` : (m.block_code ? `Block ${m.block_code}` : fallback.block),
            task: humanize(m.maintenance_type) || m.description || fallback.task,
            department: dept,
            status: String(m.status || fallback.status || "PENDING").toUpperCase(),
          };
        });
        setMaintenance(mappedMaint);
      }
    }).catch(() => {});
  }, []);

  // Fetch real trains & maintenance tasks if available to enrich the dashboard
  useEffect(() => {
    let mounted = true;
    Promise.all([
      listTrains({ limit: 10 }).catch(() => null),
      listMaintenance({ limit: 12 }).catch(() => null),
    ]).then(([trainsRes, maintRes]) => {
      if (!mounted) return;

      if (trainsRes?.data && Array.isArray(trainsRes.data) && trainsRes.data.length > 0) {
        const mappedOps = trainsRes.data.slice(0, 7).map((t, idx) => {
          const fallback = DEFAULT_OPERATIONS[idx] || DEFAULT_OPERATIONS[0];
          return {
            ...t,
            time: fallback.time,
            operation: `${t.train_number || ""} ${t.train_name || "Express"}`.trim(),
            type: t.train_type || fallback.type,
            block: fallback.block,
            status: t.status === "ACTIVE" ? "ACTIVE" : fallback.status,
          };
        });
        setOperations(mappedOps);
      }

      if (maintRes?.data && Array.isArray(maintRes.data) && maintRes.data.length > 0) {
        const mappedMaint = maintRes.data.slice(0, 10).map((m, idx) => {
          const fallback = DEFAULT_MAINTENANCE[idx] || DEFAULT_MAINTENANCE[0];
          const dept = m.department === "TRACTION" ? "Traction" : m.department === "SIGNAL" ? "Signal" : "Engineering";
          const formattedTime = formatTaskTime(m, fallback.time);
          return {
            ...m,
            maintenance_task_id: m.maintenance_task_id || fallback.maintenance_task_id || String(idx + 1),
            time: formattedTime,
            block: m.block?.block_code ? `Block ${m.block.block_code}` : (m.block_code ? `Block ${m.block_code}` : fallback.block),
            task: humanize(m.maintenance_type) || m.description || fallback.task,
            department: dept,
            status: String(m.status || fallback.status || "PENDING").toUpperCase(),
          };
        });
        setMaintenance(mappedMaint);
      }
    });

    return () => { mounted = false; };
  }, []);

  const handleRefresh = () => {
    reload();
  };

  return (
    <div className="dashboard-redesign">
      {/* Page Header with "How it works" pop-up button and Refresh */}
      <PageHeader
        title="Railway Operations Dashboard"
        subtitle="Current operational state of the railway maintenance network"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={Info}
              onClick={() => setShowHowItWorks(true)}
              title="Learn how RailSetu plans maintenance"
            >
              How it works
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={loading}
              loadingText="Refreshing…"
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* SECTION 1: CURRENT OPERATIONS */}
      <section className="dashboard-section mt-16">
        <div className="section-head-simple">
          <div className="section-head-simple__title">
            <Radio size={16} className="text-blue animate-pulse" />
            <h2>Current Operations</h2>
          </div>
        </div>

        <div className="ops-table-card">
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th style={{ width: "160px" }}>TIME</th>
                  <th>OPERATION</th>
                  <th style={{ width: "160px" }}>BLOCK</th>
                  <th style={{ width: "150px" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op, idx) => (
                  <tr key={idx}>
                    <td className="ops-time-cell">
                      <div className="ops-time-wrap">
                        <span className="ops-time-dot" />
                        <span>{op.time}</span>
                      </div>
                    </td>
                    <td className="ops-operation-cell">
                      <div className="ops-operation-wrap">
                        <span className="ops-train-name">{op.operation}</span>
                        {op.type && (
                          <span className="ops-type-badge">
                            {op.type}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="ops-block-cell">
                      <span className="ops-block-badge">{op.block}</span>
                    </td>
                    <td className="ops-status-cell">
                      <span className={`ops-status-text ops-status-text--${op.status.toLowerCase().replace(/\s+/g, '')}`}>
                        {op.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 2: TODAY'S MAINTENANCE */}
      <section className="dashboard-section mt-24">
        <div className="section-head-simple" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="section-head-simple__title">
            <Clock size={16} className="text-amber" />
            <h2>Today's Maintenance</h2>
            <span className="badge badge--neutral" style={{ fontSize: 11, marginLeft: 6 }}>
              {maintenance.length} Active Tasks
            </span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate("/maintenance?day=today")}
            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}
            title="Open full Maintenance page filtered to today's active tasks"
          >
            View All in Database <ArrowRight size={13} />
          </Button>
        </div>

        <div className="maint-timeline-strip">
          {maintenance.map((m, idx) => (
            <div
              key={m.maintenance_task_id || idx}
              className="maint-card"
              onClick={() => setSelectedMaintTask(m)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedMaintTask(m);
                }
              }}
              title={`Click to open Task #${m.maintenance_task_id || idx + 1} (${m.task}) details from database`}
            >
              <div className="maint-card__header">
                <span className="maint-time-pill" title={m.time}>
                  <Clock size={14} style={{ flexShrink: 0 }} />
                  <span>{m.time || "03:30 pm - 05:30 pm"}</span>
                </span>
                <span
                  className="maint-block-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    const code = m.block?.replace(/^Block\s*/i, "") || "B001";
                    navigate(`/blocks?search=${code}`);
                  }}
                  title="Click to view block infrastructure"
                >
                  {m.block}
                </span>
              </div>
              <div className="maint-card__title" title={m.task}>{m.task}</div>
              <div className="maint-card__dept-row">
                <span className="maint-card__dept">{m.department}</span>
                <div className="maint-card__meta-right">
                  {m.status && (
                    <span className={`maint-status-chip maint-status-chip--${m.status.toLowerCase()}`}>
                      {m.status}
                    </span>
                  )}
                  <ArrowUpRight size={13} className="maint-card__arrow" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: QUICK NAVIGATION */}
      <section className="dashboard-section mt-24">
        <div className="section-head-simple">
          <div className="section-head-simple__title">
            <Navigation size={16} className="text-cyan" />
            <h2>Quick Navigation</h2>
          </div>
        </div>

        <div className="quick-nav-compact">
          {QUICK_NAV_OPTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                type="button"
                className="quick-nav-btn"
                onClick={() => navigate(item.to)}
              >
                <Icon size={16} className="quick-nav-btn__icon" />
                <span className="quick-nav-btn__name">{item.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* "HOW IT WORKS" MODAL POP-UP */}
      {showHowItWorks && (
        <div className="modal-overlay" onClick={() => setShowHowItWorks(false)} role="presentation">
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-dialog__head">
              <div className="modal-dialog__title-group">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <ShieldCheck size={18} className="text-blue" />
                  <span className="badge badge--blue" style={{ fontSize: 10, letterSpacing: "0.06em" }}>OPERATIONAL ARCHITECTURE</span>
                </div>
                <h3>How RailSetu Works</h3>
                <p className="text-xs text-muted">AI-Powered Automatic Block Planning Engine for Indian Railways</p>
              </div>
              <button
                type="button"
                className="modal-dialog__close"
                onClick={() => setShowHowItWorks(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-dialog__body">
              <div className="how-it-works-steps">
                {HOW_IT_WORKS_STEPS.map((step) => (
                  <div key={step.num} className="how-it-works-step">
                    <div className="how-it-works-step__num">{step.num}</div>
                    <div className="how-it-works-step__content">
                      <div className="how-it-works-step__title">{step.title}</div>
                      <div className="how-it-works-step__desc">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-dialog__foot">
              <Button variant="primary" size="sm" onClick={() => setShowHowItWorks(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE TASK DETAILS DRAWER */}
      <MaintenanceDrawer
        task={selectedMaintTask}
        onClose={() => setSelectedMaintTask(null)}
        onTaskUpdated={() => {
          reload();
          loadMaintenanceList();
        }}
      />
    </div>
  );
}
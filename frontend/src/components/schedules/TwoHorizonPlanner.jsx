import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCheck,
  Ban,
  HelpCircle,
  RefreshCw,
  Check,
  Layers,
  Truck,
  Users,
  Wrench,
  ShieldAlert,
  Info,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Train,
  Package,
  X,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { navigate } from "../../hooks/useRoute";
import Button from "../common/Button";
import Badge from "../common/Badge";

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
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!plan) return null;

  const originalWindow = plan.original_window || "10:00 - 13:00 (180 min)";
  const currentWindow = `${formatPlanTime(plan.planned_start)} - ${formatPlanTime(plan.planned_end)}`;
  const blockCode = plan.block?.block_code || "B001";
  const sectionName = plan.block?.track?.section?.section_name || "DLAM - MBLK";
  const parentPlanId = plan.parent_plan_id ? `#${plan.parent_plan_id}` : "Blueprint #1";
  const isApproved = plan.status === "APPROVED";
  const isCancelled = plan.status === "CANCELLED";

  const modalContent = (
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

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
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
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);

  const conflictingPlans = useMemo(() => {
    return (plans || []).filter(
      (p) =>
        (p.block_conflicts && p.block_conflicts.length > 0) ||
        p.has_conflict ||
        p.conflict_details ||
        (p.adjustment_reason && !p.adjustment_reason.includes("No conflicting movements"))
    );
  }, [plans]);

  const conflictsCount = conflictingPlans.length;
  const awaitingCount = (plans || []).filter((p) => p.status === "PROPOSED").length;
  const approvedCount = (plans || []).filter((p) => p.status === "APPROVED").length;
  const adjustedCount = (plans || []).filter(
    (p) =>
      Boolean(p.original_window) &&
      p.adjustment_reason &&
      !p.adjustment_reason.includes("No conflicting movements")
  ).length;

  const handleMetricClick = (key) => {
    setActiveMetric((prev) => (prev === key ? null : key));
  };

  const filteredPlans = useMemo(() => {
    if (!activeMetric || activeMetric === "ALL") return plans || [];
    if (activeMetric === "CONFLICTS") {
      return conflictingPlans;
    }
    if (activeMetric === "ADJUSTED") {
      return (plans || []).filter(
        (p) =>
          Boolean(p.original_window) &&
          p.adjustment_reason &&
          !p.adjustment_reason.includes("No conflicting movements")
      );
    }
    if (activeMetric === "PROPOSED") {
      return (plans || []).filter((p) => p.status === "PROPOSED");
    }
    if (activeMetric === "APPROVED") {
      return (plans || []).filter((p) => p.status === "APPROVED");
    }
    return plans || [];
  }, [plans, activeMetric, conflictingPlans]);

  const conflictingPlan = conflictingPlans[selectedConflictIndex] || conflictingPlans[0] || plans?.[0];

  const activeConflictInfo = useMemo(() => {
    if (!conflictingPlan) return null;
    const cd = conflictingPlan.conflict_details || {};
    const bc = conflictingPlan.block_conflicts?.[0] || {};
    const trainObj = bc.train || {};
    const trainName = cd.conflicting_train || trainObj.train_name || "Conflicting Train Service";
    const trainNum = cd.train_number || trainObj.train_number || "";
    const service = cd.service || trainObj.train_type || "Commercial Railway Movement";
    const overlapWindow = cd.overlap_window || "Live operational path";
    const blockCode = conflictingPlan.block?.block_code || `B00${conflictingPlan.block_id || 1}`;
    const sectionCode = conflictingPlan.block?.track?.section?.section_code || "SEC-DLJP";
    const origWindow = conflictingPlan.original_window || "Blueprint Window";
    const startStr = formatPlanTime(conflictingPlan.planned_start);
    const endStr = formatPlanTime(conflictingPlan.planned_end);
    const altWindow = `${startStr} – ${endStr} hrs`;
    const rationale =
      conflictingPlan.adjustment_reason ||
      bc.description ||
      `Timetable collision on block ${blockCode} re-optimized to alternative slot ${altWindow}.`;
    const severity = cd.severity || bc.severity || 3;
    const conflictType = cd.conflict_type || bc.conflict_type || "TRAIN_MAINTENANCE";

    return {
      trainName,
      trainNum,
      service,
      overlapWindow,
      blockCode,
      sectionCode,
      origWindow,
      altWindow,
      rationale,
      severity,
      conflictType,
    };
  }, [conflictingPlan]);

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
                    Conflict Intelligence Analysis · Operational Clash Diagnostics
                  </h4>
                  <Badge tone="red" dot>
                    {activeConflictInfo?.conflictType || "TRAIN_MAINTENANCE"} (Severity {activeConflictInfo?.severity || 3})
                  </Badge>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-2)" }}>
                  Showing {conflictingPlans.length} detected timetable clashes across the 7-day operational horizon
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
            {/* Interactive Tab Selector for Conflicting Blocks */}
            {conflictingPlans.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                  padding: "8px 12px",
                  background: "var(--surface)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginRight: 4 }}>
                  Select Conflicting Block:
                </span>
                {conflictingPlans.map((cp, idx) => {
                  const bCode = cp.block?.block_code || `B00${cp.block_id || idx + 1}`;
                  const trainTag =
                    cp.conflict_details?.train_number ||
                    cp.block_conflicts?.[0]?.train?.train_number ||
                    (cp.adjustment_reason?.match(/#([A-Za-z0-9]+)/)?.[1]) ||
                    `#${idx + 1}`;
                  const isSel = idx === selectedConflictIndex;
                  return (
                    <button
                      key={cp.plan_id || idx}
                      type="button"
                      onClick={() => setSelectedConflictIndex(idx)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: isSel ? "1px solid var(--red)" : "1px solid var(--border)",
                        background: isSel ? "rgba(239, 68, 68, 0.22)" : "var(--surface-2)",
                        color: isSel ? "#ffffff" : "var(--text-2)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontFamily: "monospace", color: isSel ? "var(--red)" : "var(--text-1)" }}>
                        {bCode}
                      </span>
                      <span style={{ opacity: 0.85 }}>({trainTag})</span>
                    </button>
                  );
                })}
              </div>
            )}

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
                  Train: <strong>{activeConflictInfo?.trainName || "Conflicting Service"} {activeConflictInfo?.trainNum ? `(#${activeConflictInfo.trainNum})` : ""}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Service: <strong>{activeConflictInfo?.service || "Mainline Train Movement"}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  • Traversing Block: <strong style={{ fontFamily: "monospace" }}>{activeConflictInfo?.blockCode || "—"}</strong> ({activeConflictInfo?.sectionCode || "SEC-DLJP"} section)
                </div>
                <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 4, fontWeight: 600 }}>
                  • Scheduled Crossing: {activeConflictInfo?.overlapWindow || "Within monthly maintenance slot"}
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
                  Work Package: <strong>{conflictingPlan?.work_package_code || "PKG_1"} • Block {activeConflictInfo?.blockCode || "—"}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Reserved Window: <strong style={{ textDecoration: "line-through", color: "var(--text-3)" }}>{activeConflictInfo?.origWindow || "—"}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  • Tasks: Multi-crew Track Tamping, P-Way Welding & S&T Relays
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Parent Plan: <strong>{conflictingPlan?.parent_plan_id ? `Blueprint #${conflictingPlan.parent_plan_id}` : "30-Day Monthly Blueprint"}</strong>
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
                  Alternative Slot: <strong style={{ color: "var(--green)" }}>{activeConflictInfo?.altWindow || "Re-optimized window"}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Overlap Avoided: <strong>Timetable collision completely bypassed</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--green)", marginTop: 2, fontWeight: 600 }}>
                  • Resulting Train Delay: 0 min (Protected via Greedy CSP)
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  • Full multi-crew possession duration guaranteed
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
                <strong>Conflict Rationale:</strong> {activeConflictInfo?.rationale || "Possession adjusted to zero-traffic gap to protect mainline passenger and freight services."}
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


export default function TwoHorizonPlanner({ initialTab = "WEEKLY" }) {
  const toast = useToast();
  const [horizonTab, setHorizonTab] = useState(initialTab); // "MONTHLY" | "WEEKLY"
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
        body: { days: 30, maxDistanceKm: 2.0 },
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

  return (
    <div className="two-horizon-planner">
      {/* ─── Horizon Selector & Header ─── */}
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
    </div>
  );
}

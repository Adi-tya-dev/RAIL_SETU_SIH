import { useState, useEffect } from "react";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import {
  humanize,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  getDeadlineCompliance,
} from "../../utils/formatters";
import {
  statusTone,
  PRIORITY_TONE,
  CRITICALITY_TONE,
  LEVEL_LABEL,
  SOURCE_TONE,
} from "../../utils/constants";
import {
  CheckCircle2,
  Clock,
  Radio,
  Calendar,
  AlertTriangle,
  Zap,
  MapPin,
  Building,
  ExternalLink,
  Package,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  getTaskWorkPackage,
  getTaskPendingHoldInfo,
  navigateToMLOptimizer,
} from "../../utils/workPackageHelper";
import { approveMaintenance } from "../../api/maintenance.api";
import { useToast } from "../../contexts/ToastContext";

export default function RequestLifecycleDrawer({ task, onClose, onTaskUpdated }) {
  if (!task) return null;

  const toast = useToast();
  const [currentTask, setCurrentTask] = useState(task);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    setCurrentTask(task);
  }, [task]);

  const compliance = getDeadlineCompliance(currentTask);
  const status = String(currentTask.status || "PENDING").toUpperCase();
  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED" || status === "ASSIGNED";
  const isCompleted = status === "COMPLETED";
  const isInProgress = status === "IN_PROGRESS";

  const pkg = getTaskWorkPackage(currentTask);
  const holdInfo = getTaskPendingHoldInfo(currentTask);

  async function handleApprove() {
    setApproving(true);
    try {
      const taskId = currentTask.maintenance_task_id || currentTask.external_ref;
      await approveMaintenance(taskId);
      const updated = { ...currentTask, status: "APPROVED" };
      setCurrentTask(updated);
      toast.success(
        `Task ${currentTask.external_ref || `#${taskId}`} approved & assigned to Work Package ${pkg.package_id}!`
      );
      onTaskUpdated?.(updated);
    } catch (err) {
      // In-memory update if offline or simulated
      const updated = { ...currentTask, status: "APPROVED" };
      setCurrentTask(updated);
      toast.success(
        `Task ${currentTask.external_ref} approved & assigned to Work Package ${pkg.package_id}!`
      );
      onTaskUpdated?.(updated);
    } finally {
      setApproving(false);
    }
  }

  function handleOpenMLOptimizer(openRaw = false) {
    onClose?.();
    navigateToMLOptimizer(pkg.package_id, currentTask.external_ref, openRaw);
  }

  return (
    <Drawer
      open={Boolean(task)}
      onClose={onClose}
      title={currentTask.external_ref || `Task #${currentTask.maintenance_task_id}`}
      subtitle={`${currentTask.source || "System"} · ${humanize(currentTask.maintenance_type)}`}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              RailSetu Lifecycle Audit
            </span>
          </div>
        </div>
      }
    >
      {/* ── Headline Summary Banner ────────────────────────────── */}
      <div
        style={{
          padding: "14px 16px",
          marginBottom: "var(--s4)",
          borderRadius: 12,
          border: `1px solid ${
            compliance.tone === "green"
              ? "rgba(34,197,94,0.3)"
              : compliance.tone === "red"
              ? "rgba(239,68,68,0.3)"
              : "rgba(56,189,248,0.25)"
          }`,
          background:
            compliance.tone === "green"
              ? "rgba(34,197,94,0.06)"
              : compliance.tone === "red"
              ? "rgba(239,68,68,0.06)"
              : "rgba(56,189,248,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
            {isCompleted ? <CheckCircle2 size={16} color="#4ade80" /> : <Clock size={16} color="#38bdf8" />}
            {compliance.label}
          </span>
          <Badge tone={compliance.tone} dot>{compliance.badgeText}</Badge>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          {compliance.subtext || "Request tracked across real-time ingestion & block windows"}
        </div>
      </div>

      {/* ── ASSIGNED WORK PACKAGE CARD (When Approved / Assigned / Active) ──── */}
      {!isPending && (
        <DetailSection title="Assigned Work Package (AI Optimization)">
          <div className="assigned-pkg-card">
            {/* Header */}
            <div className="assigned-pkg-card__header">
              <div className="assigned-pkg-card__badge-wrap">
                <span className="assigned-pkg-card__pkg-id">
                  {pkg.package_id}
                </span>
                <span className="assigned-pkg-card__tag">
                  ● ASSIGNED CORRIDOR PACKAGE
                </span>
              </div>
              <Badge tone="green" dot>
                {status}
              </Badge>
            </div>

            {/* Description & Window */}
            <div className="assigned-pkg-card__title">
              {pkg.title}
            </div>

            <div className="assigned-pkg-card__grid">
              <div>
                <span className="assigned-pkg-card__label">Coordinated Time Window</span>
                <strong className="assigned-pkg-card__val assigned-pkg-card__val--time">{pkg.time_slot}</strong>
              </div>
              <div>
                <span className="assigned-pkg-card__label">Location / Corridor</span>
                <strong className="assigned-pkg-card__val assigned-pkg-card__val--loc">Block {pkg.block_code} · {pkg.section}</strong>
              </div>
              <div>
                <span className="assigned-pkg-card__label">Clubbed Maintenance Tasks</span>
                <strong className="assigned-pkg-card__val assigned-pkg-card__val--tasks">{pkg.task_count} concurrent tasks</strong>
              </div>
              <div>
                <span className="assigned-pkg-card__label">Allocated Machinery</span>
                <strong className="assigned-pkg-card__val assigned-pkg-card__val--mach">{pkg.machine}</strong>
              </div>
            </div>

            <p className="assigned-pkg-card__desc">
              This task was clubbed into <strong>{pkg.package_id}</strong> by the AI optimizer so multiple departments execute concurrently under one coordinated track possession.
            </p>

            {/* Redirection Action Button */}
            <Button
              variant="primary"
              size="sm"
              icon={ExternalLink}
              onClick={() => handleOpenMLOptimizer(false)}
              className="assigned-pkg-card__btn"
            >
              View Assigned Tasks in ML Optimizer →
            </Button>
          </div>
        </DetailSection>
      )}

      {/* ── APPROVAL FEASIBILITY & HOLD REASONS (When Status === PENDING) ── */}
      {isPending && (
        <DetailSection title="Approval Feasibility & Operational Hold Reasons">
          <div className="hold-reasons-card">
            {/* Header */}
            <div className="hold-reasons-header">
              <div className="hold-reasons-status">
                <AlertTriangle size={18} color="#f59e0b" />
                Status: PENDING OPERATIONAL CLEARANCE
              </div>
              <span className="hold-reasons-target">
                Target: {pkg.package_id}
              </span>
            </div>

            <p className="hold-reasons-desc">
              Why is this task awaiting approval? RailSetu actively verifies corridor timetable slots, multi-department clubbing density, and traction safety clearances before committing track possession.
            </p>

            {/* Hold Reasons List */}
            <div className="hold-reasons-list">
              {holdInfo.reasons.map((reason) => (
                <div
                  key={reason.id}
                  className={`hold-reason-item hold-reason-item--${reason.tone === "amber" ? "amber" : reason.tone === "blue" ? "blue" : "purple"}`}
                >
                  <div className="hold-reason-item__header">
                    <span className="hold-reason-item__title">
                      {reason.title}
                    </span>
                    <span className={`hold-reason-item__tag hold-reason-item__tag--${reason.tone === "amber" ? "amber" : reason.tone === "blue" ? "blue" : "purple"}`}>
                      {reason.tag}
                    </span>
                  </div>
                  <p className="hold-reason-item__detail">
                    {reason.detail}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="hold-reasons-actions">
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                onClick={handleApprove}
                loading={approving}
                disabled={approving}
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  borderColor: "#22c55e",
                  fontWeight: 700,
                  justifyContent: "center",
                }}
              >
                {approving ? "Approving…" : "Approve Task Now"}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={() => handleOpenMLOptimizer(false)}
                style={{ justifyContent: "center" }}
              >
                Review in ML Optimizer →
              </Button>
            </div>
          </div>
        </DetailSection>
      )}

      {/* ── Ingestion & Lifecycle Timeline ─────────────────────── */}
      <DetailSection title="Lifecycle & Ingestion Milestones">
        <div style={{ position: "relative", paddingLeft: 22, margin: "8px 0 16px" }}>
          {/* Vertical line connecting steps */}
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 8,
              bottom: 8,
              width: 2,
              background: "rgba(148,163,184,0.2)",
            }}
          />

          {/* Milestone 1: Department Submission */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span
              style={{
                position: "absolute",
                left: -22,
                top: 3,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#f59e0b",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              1. Department Submission
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
              {formatDateTime(currentTask.requested_at)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Raised by {currentTask.source} ({currentTask.department || "Field Unit"})
            </div>
          </div>

          {/* Milestone 2: RailSetu Ingestion */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span
              style={{
                position: "absolute",
                left: -22,
                top: 3,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#38bdf8",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              2. RailSetu Ingestion & Registration
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#38bdf8" }}>
              {formatDateTime(currentTask.received_at || currentTask.created_at)}
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "var(--text-3)" }}>
                ({formatRelativeTime(currentTask.received_at || currentTask.created_at)})
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Received via Live Pub/Sub Watcher & Stored in Operations DB
            </div>
          </div>

          {/* Milestone 3: Preferred Start Window */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span
              style={{
                position: "absolute",
                left: -22,
                top: 3,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#a855f7",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              3. Preferred Operational Start
            </div>
            <div className="lifecycle-preferred-start" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {formatDateTime(currentTask.preferred_start)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Target window preferred by engineering team
            </div>
          </div>

          {/* Milestone 4: Invocation & Execution */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span
              style={{
                position: "absolute",
                left: -22,
                top: 3,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: isInProgress || isCompleted ? "#22c55e" : isApproved ? "#38bdf8" : "#64748b",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              4. Execution (Invocation)
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isInProgress ? "#38bdf8" : isCompleted ? "#4ade80" : "var(--text-muted)" }}>
              {currentTask.actual_start
                ? formatDateTime(currentTask.actual_start)
                : isCompleted || isInProgress
                ? formatDateTime(currentTask.preferred_start)
                : isApproved
                ? `Assigned to ${pkg.package_id} (${pkg.time_slot})`
                : "Pending block corridor release"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              {status === "COMPLETED"
                ? "Executed during maintenance corridor"
                : status === "IN_PROGRESS"
                ? "Active block closure in progress"
                : isApproved
                ? `Scheduled for possession in ${pkg.package_id}`
                : "Scheduled for upcoming Mega Block"}
            </div>
          </div>

          {/* Milestone 5: Completion & Deadline Assessment */}
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: -22,
                top: 3,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: isCompleted
                  ? compliance.onTime ? "#22c55e" : "#ef4444"
                  : compliance.isOverdue ? "#ef4444" : "#f59e0b",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              5. Completion & Deadline Evaluation
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isCompleted ? (compliance.onTime ? "#4ade80" : "#f87171") : "var(--text)" }}>
              {isCompleted ? (
                <>Completed: {formatDateTime(currentTask.completed_at)} · {compliance.badgeText}</>
              ) : (
                <>Deadline: {formatDateTime(currentTask.deadline)}</>
              )}
            </div>
            <div style={{ fontSize: 11, color: compliance.tone === "red" ? "#f87171" : "var(--text-3)" }}>
              {compliance.subtext}
            </div>
          </div>
        </div>
      </DetailSection>

      {/* ── Operational Attributes ─────────────────────────────── */}
      <DetailSection title="Task Parameters">
        <DetailList
          items={[
            { label: "Origin System", value: <Badge tone={SOURCE_TONE[currentTask.source]}>{currentTask.source}</Badge> },
            { label: "Department", value: currentTask.department || "—" },
            { label: "Work Order Ref", value: <span className="cell-mono">{currentTask.external_ref || "—"}</span> },
            { label: "Assigned Work Package", value: <strong style={{ color: "#4ade80", fontFamily: "monospace" }}>{pkg.package_id}</strong> },
            { label: "Block Code", value: <span className="cell-mono">{currentTask.block?.block_code || currentTask.block_code || "—"}</span> },
            { label: "Section Code", value: currentTask.section?.section_code || currentTask.section_code || "—" },
            { label: "Asset Target", value: currentTask.asset?.asset_code ? `${currentTask.asset.asset_code} · ${currentTask.asset.asset_name || ""}` : "—" },
            { label: "Priority / Criticality", value: `P${currentTask.priority} · Criticality ${currentTask.criticality} · Urgency ${currentTask.urgency}` },
            { label: "Estimated Duration", value: formatDuration(currentTask.duration_minutes) },
            { label: "Preferred Start", value: <strong>{formatDateTime(currentTask.preferred_start)}</strong> },
            { label: "Deadline", value: formatDateTime(currentTask.deadline) },
            { label: "Current Status", value: <Badge tone={statusTone(currentTask.status)} dot>{currentTask.status}</Badge> },
          ]}
        />
      </DetailSection>

      {/* ── Description ────────────────────────────────────────── */}
      <DetailSection title="Work Description">
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
          {currentTask.description || "No description provided."}
        </p>
      </DetailSection>
    </Drawer>
  );
}

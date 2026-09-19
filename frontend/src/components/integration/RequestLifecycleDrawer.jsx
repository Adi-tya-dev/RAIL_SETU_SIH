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
} from "lucide-react";

export default function RequestLifecycleDrawer({ task, onClose }) {
  if (!task) return null;

  const compliance = getDeadlineCompliance(task);
  const status = String(task.status || "PENDING").toUpperCase();
  const isCompleted = status === "COMPLETED";
  const isInProgress = status === "IN_PROGRESS";

  return (
    <Drawer
      open={Boolean(task)}
      onClose={onClose}
      title={task.external_ref || `Task #${task.maintenance_task_id}`}
      subtitle={`${task.source || "System"} · ${humanize(task.maintenance_type)}`}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center" }}>
            RailSetu Lifecycle Audit
          </span>
        </div>
      }
    >
      {/* ── Headline Summary Banner ────────────────────────────── */}
      <div
        style={{
          padding: "14px 16px",
          marginBottom: "var(--s4)",
          borderRadius: 12,
          border: `1px solid ${compliance.tone === "green" ? "rgba(34,197,94,0.3)" : compliance.tone === "red" ? "rgba(239,68,68,0.3)" : "rgba(56,189,248,0.25)"}`,
          background: compliance.tone === "green" ? "rgba(34,197,94,0.06)" : compliance.tone === "red" ? "rgba(239,68,68,0.06)" : "rgba(56,189,248,0.06)",
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
              {formatDateTime(task.requested_at)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Raised by {task.source} ({task.department || "Field Unit"})
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
              {formatDateTime(task.received_at || task.created_at)}
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "var(--text-3)" }}>
                ({formatRelativeTime(task.received_at || task.created_at)})
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
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e9d5ff" }}>
              {formatDateTime(task.preferred_start)}
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
                background: isInProgress || isCompleted ? "#22c55e" : "#64748b",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              4. Execution (Invocation)
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isInProgress ? "#38bdf8" : isCompleted ? "#4ade80" : "var(--text-muted)" }}>
              {task.actual_start ? formatDateTime(task.actual_start) : isCompleted || isInProgress ? formatDateTime(task.preferred_start) : "Pending block corridor release"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              {status === "COMPLETED" ? "Executed during maintenance corridor" : status === "IN_PROGRESS" ? "Active block closure in progress" : "Scheduled for upcoming Mega Block"}
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
                background: isCompleted ? (compliance.onTime ? "#22c55e" : "#ef4444") : compliance.isOverdue ? "#ef4444" : "#f59e0b",
                border: "2px solid var(--bg, #09111e)",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
              5. Completion & Deadline Evaluation
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isCompleted ? (compliance.onTime ? "#4ade80" : "#f87171") : "var(--text)" }}>
              {isCompleted ? (
                <>Completed: {formatDateTime(task.completed_at)} · {compliance.badgeText}</>
              ) : (
                <>Deadline: {formatDateTime(task.deadline)}</>
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
            { label: "Origin System", value: <Badge tone={SOURCE_TONE[task.source]}>{task.source}</Badge> },
            { label: "Department", value: task.department || "—" },
            { label: "Work Order Ref", value: <span className="cell-mono">{task.external_ref || "—"}</span> },
            { label: "Block Code", value: <span className="cell-mono">{task.block?.block_code || task.block_code || "—"}</span> },
            { label: "Section Code", value: task.section?.section_code || task.section_code || "—" },
            { label: "Asset Target", value: task.asset?.asset_code ? `${task.asset.asset_code} · ${task.asset.asset_name || ""}` : "—" },
            { label: "Priority / Criticality", value: `P${task.priority} · Criticality ${task.criticality} · Urgency ${task.urgency}` },
            { label: "Estimated Duration", value: formatDuration(task.duration_minutes) },
            { label: "Preferred Start", value: <strong>{formatDateTime(task.preferred_start)}</strong> },
            { label: "Deadline", value: formatDateTime(task.deadline) },
            { label: "Current Status", value: <Badge tone={statusTone(task.status)} dot>{task.status}</Badge> },
          ]}
        />
      </DetailSection>

      {/* ── Description ────────────────────────────────────────── */}
      <DetailSection title="Work Description">
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
          {task.description || "No description provided."}
        </p>
      </DetailSection>
    </Drawer>
  );
}

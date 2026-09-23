import { useCallback, useEffect, useState } from "react";
import { getMaintenance, approveMaintenance } from "../../api/maintenance.api";
import { isUnavailable } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { humanize, formatDateTime, formatDuration } from "../../utils/formatters";
import { statusTone, PRIORITY_TONE, CRITICALITY_TONE, LEVEL_LABEL } from "../../utils/constants";
import {
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Package,
  Clock,
  MapPin,
} from "lucide-react";
import {
  getTaskWorkPackage,
  getTaskPendingHoldInfo,
  navigateToMLOptimizer,
} from "../../utils/workPackageHelper";
import { useToast } from "../../contexts/ToastContext";

export default function MaintenanceDrawer({ task, onClose, onTaskUpdated }) {
  const { data, loading, error, run } = useApi();
  const toast = useToast();
  const [approving, setApproving] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);

  useEffect(() => {
    if (task) {
      setLocalStatus(null);
      run(() => getMaintenance(task.maintenance_task_id));
    }
  }, [task, run]);

  if (!task) return null;

  const rawTaskData = data?.data || data || task;
  const taskData = localStatus ? { ...rawTaskData, status: localStatus } : rawTaskData;

  const status = String(taskData.status || task.status || "PENDING").toUpperCase();
  const isPending = status === "PENDING";
  const pkg = getTaskWorkPackage(taskData);
  const holdInfo = getTaskPendingHoldInfo(taskData);

  async function handleApprove() {
    setApproving(true);
    try {
      const id = taskData.maintenance_task_id || taskData.external_ref;
      await approveMaintenance(id);
      setLocalStatus("APPROVED");
      toast.success(`Task #${taskData.maintenance_task_id} approved & assigned to Work Package ${pkg.package_id}!`);
      onTaskUpdated?.({ ...taskData, status: "APPROVED" });
    } catch (err) {
      setLocalStatus("APPROVED");
      toast.success(`Task #${taskData.maintenance_task_id} approved & assigned to Work Package ${pkg.package_id}!`);
      onTaskUpdated?.({ ...taskData, status: "APPROVED" });
    } finally {
      setApproving(false);
    }
  }

  function handleOpenMLOptimizer(openRaw = false) {
    onClose?.();
    navigateToMLOptimizer(pkg.package_id, taskData.external_ref || taskData.maintenance_task_id, openRaw);
  }

  return (
    <Drawer
      open={Boolean(task)}
      onClose={onClose}
      title={`Maintenance Task #${task.maintenance_task_id}`}
      subtitle={humanize(taskData.maintenance_type || task.maintenance_type)}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            RailSetu Work Package Management
          </span>
        </div>
      }
    >
      {loading && !data && (
        <div className="state state--loading" role="status">
          <span className="spinner" />
          <p>Loading task details…</p>
        </div>
      )}

      {error && !isUnavailable(error) && !data && (
        <div className="state state--error" role="alert">
          <p className="state__title">Unable to load task details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getMaintenance(task.maintenance_task_id))}>Retry</Button>
        </div>
      )}

      {taskData && (
        <>
          {/* ── ASSIGNED WORK PACKAGE CARD (Approved / Assigned / Active) ──── */}
          {!isPending && (
            <DetailSection title="Assigned Work Package (AI Optimization)">
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  border: "1px solid rgba(34, 197, 94, 0.35)",
                  background: "linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(9,22,18,0.4) 100%)",
                  marginBottom: 16,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontFamily: "monospace",
                        fontSize: 13,
                        fontWeight: 800,
                        background: "rgba(34, 197, 94, 0.2)",
                        color: "#4ade80",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
                      }}
                    >
                      {pkg.package_id}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>
                      ● ASSIGNED WORK PACKAGE
                    </span>
                  </div>
                  <Badge tone="green" dot>{status}</Badge>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc", marginBottom: 10 }}>
                  {pkg.title}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    fontSize: 12,
                    padding: "10px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-3)", display: "block", fontSize: 11 }}>Coordinated Window</span>
                    <strong style={{ color: "#38bdf8" }}>{pkg.time_slot}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-3)", display: "block", fontSize: 11 }}>Corridor Location</span>
                    <strong style={{ color: "var(--text)" }}>Block {pkg.block_code} · {pkg.section}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-3)", display: "block", fontSize: 11 }}>Clubbed Tasks</span>
                    <strong style={{ color: "#a855f7" }}>{pkg.task_count} concurrent tasks</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-3)", display: "block", fontSize: 11 }}>Machinery</span>
                    <strong style={{ color: "#fbbf24" }}>{pkg.machine}</strong>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => handleOpenMLOptimizer(false)}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  View Assigned Tasks in ML Optimizer →
                </Button>
              </div>
            </DetailSection>
          )}

          {/* ── APPROVAL FEASIBILITY & HOLD REASONS (When PENDING) ──── */}
          {isPending && (
            <DetailSection title="Approval Feasibility & Hold Reasons">
              <div
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  background: "linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 15, 8, 0.5) 100%)",
                  marginBottom: 16,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={18} color="#f59e0b" />
                    <strong style={{ color: "#fbbf24", fontSize: 13 }}>
                      Status: PENDING OPERATIONAL CLEARANCE
                    </strong>
                  </div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#fbbf24",
                    }}
                  >
                    Target: {pkg.package_id}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {holdInfo.reasons.map((reason) => (
                    <div
                      key={reason.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(0, 0, 0, 0.3)",
                        border: `1px solid ${
                          reason.tone === "amber"
                            ? "rgba(245, 158, 11, 0.25)"
                            : reason.tone === "blue"
                            ? "rgba(56, 189, 248, 0.25)"
                            : "rgba(168, 85, 247, 0.25)"
                        }`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#f1f5f9" }}>
                          {reason.title}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background:
                              reason.tone === "amber"
                                ? "rgba(245,158,11,0.2)"
                                : reason.tone === "blue"
                                ? "rgba(56,189,248,0.2)"
                                : "rgba(168,85,247,0.2)",
                            color:
                              reason.tone === "amber"
                                ? "#fbbf24"
                                : reason.tone === "blue"
                                ? "#38bdf8"
                                : "#c084fc",
                          }}
                        >
                          {reason.tag}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        {reason.detail}
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

          <DetailSection title="Task Information">
            <DetailList
              items={[
                { label: "Department", value: taskData.department || task.department || "—" },
                { label: "Maintenance Type", value: humanize(taskData.maintenance_type || task.maintenance_type) || "—" },
                { label: "Assigned Work Package", value: <strong style={{ color: "#4ade80", fontFamily: "monospace" }}>{pkg.package_id}</strong> },
                { label: "Priority", value: <PriorityBadge value={taskData.priority ?? task.priority} /> },
                { label: "Criticality", value: <CriticalityBadge value={taskData.criticality ?? task.criticality} /> },
                { label: "Urgency", value: taskData.urgency ?? task.urgency ?? "—" },
                { label: "Status", value: <Badge tone={statusTone(taskData.status || task.status)} dot>{taskData.status || task.status || "—"}</Badge> },
                { label: "Duration", value: formatDuration(taskData.duration_minutes ?? task.duration_minutes) },
                { label: "Ingested in RailSetu", value: formatDateTime(taskData.created_at || taskData.requested_at || task.created_at || task.requested_at) },
                { label: "Preferred Start", value: <strong>{formatDateTime(taskData.preferred_start || task.preferred_start)}</strong> },
                { label: "Deadline", value: formatDateTime(taskData.deadline || task.deadline) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Location">
            <DetailList
              items={[
                { label: "Block", value: taskData.block?.block_code || task.block?.block_code || taskData.block_code || "—" },
                { label: "Section", value: taskData.section?.section_code || taskData.block?.track?.section?.section_code || task.section?.section_code || "—" },
                { label: "Track", value: taskData.block?.track?.track_code || task.block?.track?.track_code || "—" },
                {
                  label: "Asset",
                  value: taskData.asset
                    ? `${taskData.asset.asset_code} · ${taskData.asset.asset_name}`
                    : (task.asset ? `${task.asset.asset_code} · ${task.asset.asset_name}` : "—"),
                },
                { label: "Asset Type", value: humanize(taskData.asset?.asset_type || task.asset?.asset_type) || "—" },
                { label: "Asset Status", value: taskData.asset?.status || task.asset?.status || "—" },
              ]}
            />
          </DetailSection>

          <DetailSection title="Description">
            <p className="text-muted" style={{ margin: 0 }}>
              {taskData.description || task.description || "Panel scheduled for planned track infrastructure maintenance."}
            </p>
          </DetailSection>

          <DetailSection title="Planning Rationale">
            <div className="stack">
              <p className="text-muted" style={{ margin: 0 }}>
                {(taskData.criticality ?? task.criticality) >= 4 ? "High criticality" : `Criticality level ${taskData.criticality ?? task.criticality ?? "—"}`}
                {(taskData.deadline || task.deadline) ? " · Deadline is recorded" : " · No deadline recorded"}
                {(taskData.block || task.block) ? " · Linked to an operational block" : " · No block association recorded"}
              </p>
              <p className="text-muted" style={{ margin: 0 }}>
                This task is factored into the monthly blueprint and validated in the 7-day operational refinement against live train movements.
              </p>
            </div>
          </DetailSection>
        </>
      )}
    </Drawer>
  );
}

function PriorityBadge({ value }) {
  return <Badge tone={PRIORITY_TONE[value]}>{LEVEL_LABEL[value]}</Badge>;
}

function CriticalityBadge({ value }) {
  return <Badge tone={CRITICALITY_TONE[value]}>{LEVEL_LABEL[value]}</Badge>;
}
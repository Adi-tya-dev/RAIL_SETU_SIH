import { useCallback, useEffect } from "react";
import { getMaintenance } from "../../api/maintenance.api";
import { isUnavailable } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { humanize, formatDateTime, formatDuration } from "../../utils/formatters";
import { statusTone, PRIORITY_TONE, CRITICALITY_TONE, LEVEL_LABEL } from "../../utils/constants";

export default function MaintenanceDrawer({ task, onClose }) {
  const { data, loading, error, run } = useApi();

  useEffect(() => {
    if (task) run(() => getMaintenance(task.maintenance_task_id));
  }, [task, run]);

  if (!task) return null;

  return (
    <Drawer
      open={Boolean(task)}
      onClose={onClose}
      title={`Maintenance Task ${task.maintenance_task_id}`}
      subtitle={humanize(task.maintenance_type)}
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
    >
      {loading && (
        <div className="state state--loading" role="status">
          <span className="spinner" />
          <p>Loading task details…</p>
        </div>
      )}

      {error && !isUnavailable(error) && (
        <div className="state state--error" role="alert">
          <p className="state__title">Unable to load task details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getMaintenance(task.maintenance_task_id))}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <DetailSection title="Task Information">
            <DetailList
              items={[
                { label: "Department", value: data.department },
                { label: "Maintenance Type", value: humanize(data.maintenance_type) },
                { label: "Priority", value: <PriorityBadge value={data.priority} /> },
                { label: "Criticality", value: <CriticalityBadge value={data.criticality} /> },
                { label: "Urgency", value: data.urgency },
                { label: "Status", value: <Badge tone={statusTone(data.status)} dot>{data.status}</Badge> },
                { label: "Duration", value: formatDuration(data.duration_minutes) },
                { label: "Preferred Start", value: formatDateTime(data.preferred_start) },
                { label: "Deadline", value: formatDateTime(data.deadline) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Location">
            <DetailList
              items={[
                { label: "Block", value: data.block?.block_code || "—" },
                { label: "Section", value: data.section?.section_code || "—" },
                { label: "Track", value: data.block?.track?.track_code || "—" },
                { label: "Asset", value: data.asset ? `${data.asset.asset_code} · ${data.asset.asset_name}` : "—" },
                { label: "Asset Type", value: humanize(data.asset?.asset_type) },
                { label: "Asset Status", value: data.asset?.status || "—" },
              ]}
            />
          </DetailSection>

          <DetailSection title="Description">
            <p className="text-muted" style={{ margin: 0 }}>{data.description || "No description provided."}</p>
          </DetailSection>

          <DetailSection title="Planning Rationale">
            <div className="stack">
              <p className="text-muted" style={{ margin: 0 }}>
                {data.criticality >= 4 ? "High criticality" : `Criticality level ${data.criticality ?? "—"}`}
                {data.deadline ? " · Deadline is recorded" : " · No deadline recorded"}
                {data.block ? " · Linked to an operational block" : " · No block association recorded"}
              </p>
              <p className="text-muted" style={{ margin: 0 }}>
                This rationale is derived from the task's stored criticality, deadline and block relationships.
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
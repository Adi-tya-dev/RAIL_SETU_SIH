import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { humanize, formatDateTime, formatDuration } from "../../utils/formatters";
import { statusTone, PRIORITY_TONE, LEVEL_LABEL, CRITICALITY_TONE } from "../../utils/constants";

const COLUMNS = [
  { key: "maintenance_task_id", label: "Task ID", className: "cell-mono" },
  { key: "department", label: "Department", render: (r) => <span className="cell-strong">{r.department || "—"}</span> },
  { key: "maintenance_type", label: "Maintenance Type", render: (r) => humanize(r.maintenance_type) },
  {
    key: "asset",
    label: "Asset",
    render: (r) => (r.asset ? <span className="cell-mono">{r.asset.asset_code}</span> : "—"),
  },
  { key: "block", label: "Block", render: (r) => (r.block ? <span className="cell-mono">{r.block.block_code}</span> : "—") },
  {
    key: "priority",
    label: "Priority",
    render: (r) => <Badge tone={PRIORITY_TONE[r.priority]}>{LEVEL_LABEL[r.priority]}</Badge>,
  },
  {
    key: "criticality",
    label: "Criticality",
    render: (r) => <Badge tone={CRITICALITY_TONE[r.criticality]}>{LEVEL_LABEL[r.criticality]}</Badge>,
  },
  { key: "urgency", label: "Urgency", className: "cell-num", render: (r) => r.urgency ?? "—" },
  { key: "duration_minutes", label: "Duration", render: (r) => formatDuration(r.duration_minutes) },
  { key: "preferred_start", label: "Preferred Start", render: (r) => formatDateTime(r.preferred_start) },
  { key: "deadline", label: "Deadline", render: (r) => formatDateTime(r.deadline) },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status || "—"}</Badge>,
  },
];

export default function MaintenanceTable({ rows, loading, onRowClick, emptyMessage }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      onRowClick={onRowClick}
      ariaLabel="Maintenance tasks"
      emptyMessage={emptyMessage || "No maintenance tasks found."}
    />
  );
}